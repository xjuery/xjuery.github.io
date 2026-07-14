---
title: "Filebeat et stacktraces Java : arrêter de perdre la moitié de l'erreur"
date: 2026-07-19T09:10:00+02:00
tags: [filebeat, astuces]
featured: false
draft: true
summary: "Une stacktrace Java fait 40 lignes ; mal configuré, Filebeat en fait 40 documents inutilisables. Configuration multiline pas à pas, avec une application de test qui génère de vraies stacktraces, jusqu'à des documents Elasticsearch complets et exploitables."
---

Ouvrez Kibana sur un projet Java fraîchement branché à Filebeat, cherchez
une erreur, et vous tomberez souvent sur ce spectacle : la première ligne
de l'exception dans un document, puis quarante documents orphelins
contenant chacun un `at com.example...` solitaire. La stacktrace est là,
mais éparpillée — impossible de la lire, impossible de compter les
erreurs, impossible d'alerter dessus.

La cause est simple : **Filebeat lit ligne par ligne, une stacktrace Java
s'étale sur plusieurs lignes**. Voyons comment recoller les morceaux, avec
une application de test pour vérifier chaque étape.

![Schéma du pipeline : application Java, fichier de log multiligne, Filebeat avec parser multiline, Elasticsearch avec pipeline d'ingestion](/images/posts/filebeat-stacktraces-java/pipeline.svg)

## L'application de test

Pour travailler sur du vrai, une mini-application qui logge du trafic
normal et lève une exception imbriquée toutes les cinq secondes :

```java {filename="LogGenerator.java"}
public class LogGenerator {
    private static final Logger log = LoggerFactory.getLogger(LogGenerator.class);

    public static void main(String[] args) throws InterruptedException {
        while (true) {
            log.info("Traitement de la commande {}", UUID.randomUUID());
            Thread.sleep(1000);
            try {
                chargerCommande();
            } catch (Exception e) {
                log.error("Échec du traitement de la commande", e);
            }
            Thread.sleep(4000);
        }
    }

    static void chargerCommande() {
        try {
            throw new SQLException("Connection refused: connect");
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de charger la commande", e);
        }
    }
}
```

Avec un pattern Logback classique :

```xml {filename="logback.xml"}
<appender name="FILE" class="ch.qos.logback.core.FileAppender">
  <file>/var/log/demo/app.log</file>
  <encoder>
    <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n</pattern>
  </encoder>
</appender>
```

Le fichier produit ressemble à ceci — notez que **seule la première ligne
commence par une date** :

```text {filename="app.log"}
2026-07-14 09:12:03.412 INFO  [main] c.e.LogGenerator - Traitement de la commande 4f2a...
2026-07-14 09:12:04.418 ERROR [main] c.e.LogGenerator - Échec du traitement de la commande
java.lang.IllegalStateException: Impossible de charger la commande
	at com.example.LogGenerator.chargerCommande(LogGenerator.java:24)
	at com.example.LogGenerator.main(LogGenerator.java:13)
Caused by: java.sql.SQLException: Connection refused: connect
	at com.example.LogGenerator.chargerCommande(LogGenerator.java:22)
	... 1 common frames omitted
```

C'est cette propriété qu'on va exploiter : *une ligne qui ne commence pas
par un timestamp appartient au message précédent*.

## Étape 1 — le parser multiline de Filebeat

Depuis Filebeat 7.16, l'entrée recommandée est `filestream`, et le
regroupement multiligne se déclare dans la liste `parsers` :

```yaml {filename="filebeat.yml"}
filebeat.inputs:
  - type: filestream
    id: demo-java-app
    paths:
      - /var/log/demo/app.log
    parsers:
      - multiline:
          type: pattern
          pattern: '^\d{4}-\d{2}-\d{2}'   # une ligne qui commence par une date...
          negate: true                     # ...ne matche PAS ce pattern ?
          match: after                     # alors colle-la à la ligne précédente
          max_lines: 200
          timeout: 5s

output.elasticsearch:
  hosts: ["https://elasticsearch:9200"]
```

Les trois options se lisent ensemble et méritent d'être décodées une fois
pour toutes :

- `pattern` décrit **la première ligne d'un événement** (ici : commence
  par une date `YYYY-MM-DD`).
- `negate: true` + `match: after` signifie : « toute ligne qui ne
  ressemble *pas* à un début d'événement est rattachée *après* la ligne
  précédente ». C'est la combinaison à retenir pour les logs applicatifs
  Java — les `at ...`, `Caused by:` et `... N common frames omitted` ne
  commencent jamais par une date, ils sont donc absorbés.
- `max_lines` (500 par défaut) : au-delà, les lignes sont jetées. 200
  suffit largement pour une stacktrace, même avec trois `Caused by`.

Deux pièges classiques à ce stade :

- **Ancrer le pattern.** Sans `^`, une date en plein milieu d'un message
  (« import du 2026-07-01 échoué ») déclencherait un faux découpage.
- **Le `timeout`** : si l'application écrit sa stacktrace lentement (buffer,
  GC…), Filebeat attend jusqu'à 5 s de silence avant d'expédier
  l'événement. Inutile d'y toucher, mais c'est lui qui explique le léger
  délai d'apparition des erreurs.

Après redémarrage de Filebeat, chaque erreur arrive dans Elasticsearch en
**un seul document** : le champ `message` contient les 40 lignes,
stacktrace complète incluse. Premier objectif atteint.

## Étape 2 — extraire les champs qui rendent le document exploitable

Un gros bloc de texte dans `message`, c'est lisible mais pas requêtable.
Pour filtrer sur `log.level: ERROR` ou agréger par classe d'exception, il
faut découper la première ligne en champs. Sans Logstash, un **pipeline
d'ingestion** Elasticsearch fait très bien le travail :

```json {filename="PUT _ingest/pipeline/java-logs"}
{
  "processors": [
    {
      "grok": {
        "field": "message",
        "patterns": [
          "%{TIMESTAMP_ISO8601:app.timestamp} %{LOGLEVEL:log.level}\\s+\\[%{DATA:app.thread}\\] %{JAVACLASS:log.logger} - %{GREEDYMULTILINE:app.message}"
        ],
        "pattern_definitions": {
          "GREEDYMULTILINE": "(.|\\n)*"
        }
      }
    },
    {
      "grok": {
        "field": "app.message",
        "patterns": [
          "%{DATA:app.short_message}\\n%{JAVACLASS:error.type}(: %{DATA:error.message})?\\n%{GREEDYMULTILINE:error.stack_trace}"
        ],
        "pattern_definitions": { "GREEDYMULTILINE": "(.|\\n)*" },
        "ignore_failure": true
      }
    },
    {
      "date": {
        "field": "app.timestamp",
        "formats": ["yyyy-MM-dd HH:mm:ss.SSS"],
        "timezone": "Europe/Paris"
      }
    }
  ]
}
```

Le deuxième `grok`, marqué `ignore_failure`, ne s'applique qu'aux messages
qui contiennent effectivement une stacktrace : il isole la classe de
l'exception dans `error.type`, son message dans `error.message` et la
pile dans `error.stack_trace` — les noms de champs standard ECS, ceux que
Kibana et les règles d'alerte connaissent déjà.

Reste à dire à Filebeat d'envoyer les documents dans ce pipeline :

```yaml {filename="filebeat.yml"}
output.elasticsearch:
  hosts: ["https://elasticsearch:9200"]
  pipeline: java-logs
```

## Étape 3 — vérifier le résultat

Avant d'attendre Kibana, testez le pipeline avec l'API `_simulate`, en
collant un événement multiligne tel que Filebeat l'envoie :

```bash
curl -X POST "localhost:9200/_ingest/pipeline/java-logs/_simulate" \
  -H 'Content-Type: application/json' -d '
{
  "docs": [{ "_source": { "message": "2026-07-14 09:12:04.418 ERROR [main] c.e.LogGenerator - Échec du traitement de la commande\njava.lang.IllegalStateException: Impossible de charger la commande\n\tat com.example.LogGenerator.chargerCommande(LogGenerator.java:24)" } }]
}'
```

Le document simulé doit ressortir avec tous les champs découpés :

```json
{
  "log.level": "ERROR",
  "log.logger": "c.e.LogGenerator",
  "app.thread": "main",
  "app.short_message": "Échec du traitement de la commande",
  "error.type": "java.lang.IllegalStateException",
  "error.message": "Impossible de charger la commande",
  "error.stack_trace": "\tat com.example.LogGenerator.chargerCommande(...)"
}
```

Dans Kibana, on peut maintenant écrire les requêtes qui étaient
impossibles au début :

```text
log.level: "ERROR" and error.type: "java.lang.IllegalStateException"
```

Et surtout construire une visualisation « top 10 des `error.type` sur
24 h » — le tableau de bord qui révèle en un coup d'œil l'exception qui
noie les logs.

## L'alternative qui supprime le problème : logger en JSON

Tout ce qui précède répare un format pensé pour les humains. L'autre école
consiste à produire directement du JSON avec
[ecs-logging-java](https://www.elastic.co/guide/en/ecs-logging/java/current/setup.html) :

```xml {filename="logback.xml"}
<appender name="FILE" class="ch.qos.logback.core.FileAppender">
  <file>/var/log/demo/app.log.json</file>
  <encoder class="co.elastic.logging.logback.EcsEncoder"/>
</appender>
```

Chaque événement devient une ligne JSON unique — stacktrace comprise,
échappée dans le champ `error.stack_trace`. Côté Filebeat, plus de
multiline ni de grok, un simple parser `ndjson` :

```yaml {filename="filebeat.yml"}
parsers:
  - ndjson:
      target: ""
      overwrite_keys: true
```

Si vous maîtrisez l'application, c'est la meilleure option : zéro regex,
zéro risque de pattern qui casse au prochain changement de format de log.
La configuration multiline reste indispensable pour tout ce que vous ne
contrôlez pas — applications tierces, legacy, logs de serveurs
d'applications.

> Une stacktrace éparpillée sur 40 documents ne sert à personne. Le trio
> `pattern` ancré sur le timestamp + `negate: true` + `match: after`
> recolle l'événement dans Filebeat ; un pipeline d'ingestion en extrait
> `error.type` et `error.stack_trace` ; et si vous pouvez toucher à
> l'application, loggez en JSON ECS et supprimez le problème à la source.
