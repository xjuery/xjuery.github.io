---
title: "Filebeat & les stacktraces Java"
date: 2025-07-19
draft: true
categories: ["Elastic"]
tags: ["elastic", "filebeat"]
autor: "Xavier JUERY"
---

## Parser des logs multilignes avec Filebeat

### 🔍 Qu'est-ce que Filebeat ?

**Filebeat** est un agent léger développé par **Elastic** qui lit les fichiers de log et les envoie à une destination comme **Logstash**, **Elasticsearch**, ou un autre système d’analyse. Il est particulièrement utilisé dans les environnements distribués pour collecter les logs de manière centralisée.

Avantages :
- Léger et rapide
- Facile à configurer
- Intégration native avec la suite **Elastic Stack** (ELK)

### 🎯 Objectif : gérer les logs multilignes

#### Le problème

Dans beaucoup d'applications, notamment en **Java**, certaines erreurs comme les **stacktraces** s'étalent sur plusieurs lignes :

```text
Exception in thread "main" java.lang.NullPointerException
	at com.example.myproject.Book.getTitle(Book.java:16)
	at com.example.myproject.Author.getBookTitles(Author.java:25)
	at com.example.myproject.Bootstrap.main(Bootstrap.java:14)
```

Sans configuration spécifique, Filebeat envoie chaque ligne comme un événement distinct, ce qui rend l’analyse dans Elasticsearch ou Kibana très difficile.

#### Solution : configuration multiline dans Filebeat

Filebeat permet de regrouper plusieurs lignes en un seul événement à l’aide d’une règle multiline.

⸻

🛠 Exemple de configuration Filebeat générique pour des logs multi-lignes

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/my-java-app/*.log

    multiline.pattern: '^\s'
    multiline.negate: false
    multiline.match: after
```

🧠 Explication de cette configuration :

| Paramètre | Description |
| --------- | ----------- |
|multiline.pattern|Une expression régulière qui détecte les lignes à ajouter à l’événement précédent. Ici, ^\s correspond à une ligne commençant par un espace ou une tabulation (comme les lignes d’une stacktrace).|
|multiline.negate | S’il est à false, cela signifie que les lignes correspondant au pattern (^\s) sont des suites, donc doivent être concaténées avec la ligne précédente.|
|multiline.match | "after" signifie que les lignes suivantes (celles qui matchent le pattern) sont à attacher à la précédente.|

#### 🔁 Variante : début de ligne avec un timestamp

Si vos logs Java commencent par un timestamp, vous pouvez inverser la logique :

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/my-java-app/*.log

    multiline.pattern: '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'
    multiline.negate: true
    multiline.match: after
```
Cette configuration signifie :

- Toute ligne ne commençant pas par un timestamp (comme les lignes d’une stacktrace) est considérée comme faisant partie de la ligne précédente.


💡 Bonnes pratiques
- Tester vos regex avant de les appliquer. Utilisez un outil comme regex101.com.
- Limiter la taille des événements multilignes avec close_inactive ou max_bytes.
- Utilisez le module Filebeat Java si disponible (dans certaines distributions Elastic).
- Surveillez la charge de Filebeat avec des logs très verbeux.

### Conclusion

Configurer Filebeat pour gérer les logs multilignes comme les stacktraces Java est essentiel pour garantir une bonne qualité de vos données dans Elasticsearch. Grâce à la directive multiline, il est possible de regrouper correctement ces logs, ce qui améliore considérablement leur exploitabilité dans Kibana.