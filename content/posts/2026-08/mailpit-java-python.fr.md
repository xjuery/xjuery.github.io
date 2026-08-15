---
title: "Mailpit : testez vos e-mails en Java et en Python"
date: 2026-08-23T15:21:41+02:00
tags: [tools]
banner: /images/posts/mailpit-java-python/banner.fr.png
featured: true
draft: false
summary: "Un faux serveur SMTP avec une vraie boîte de réception : Mailpit capture les e-mails de votre appli au lieu de les délivrer. Configuration côté Java et Python, vérification à la main puis en CI grâce à son API REST."
---

*« Spammez sans remords : ici, aucun e-mail n'atteint de vrai destinataire. »*

Beaucoup de projets finissent par envoyer des e-mails - inscription, mot de passe
oublié, facture. L'email reste le moyen le plus commun de notifier ses utilisateurs.
Et tout développeur finit par se poser la même question :
comment tester ça sans arroser de vrais utilisateurs ? Les réponses
classiques sont toutes mauvaises : commenter l'appel d'envoi, rediriger vers
sa propre boîte Gmail à coups d'alias `+test`, ou pire, croiser les doigts
et regarder les logs. Mauvaises, car elles ne respectent pas un principe fondamental : on ne modifie pas un package entre les tests et la mise en production. Ce qui a été validé doit être ce qui est déployé (certains reconnaitront le principe d'immutabilité des packages, aussi résumé par "Build once, deploy anywhere").

Mailpit règle le problème avec une idée simple : un **serveur SMTP de
capture**, accompagné d'une interface web et d'une API REST. Votre
application lui parle comme à un vrai serveur de mail, il intercepte tout,
et rien ne repart vers l'extérieur. 

Et par rapport à notre principe d'immutabilité des packages, la différence entre les tests (avec mailpit) et la mise en production (avec un serveur smtp de production) se résument à un changement de configuration (comme si on avait affaire à des serveurs différents sur des environnements différents).

## Un faux SMTP, une vraie boîte de réception

Mailpit écoute sur deux ports :

- **1025** - le serveur SMTP. Pointez-y votre application ; dans sa
  configuration par défaut, il n'exige ni authentification ni chiffrement
  (les deux existent en option si vous voulez tester ce chemin-là aussi).
- **8025** - l'interface web et l'API REST. Chaque e-mail capturé y
  apparaît en temps réel, avec son rendu HTML, sa version texte, ses
  en-têtes et ses pièces jointes.

Par défaut, **aucun message n'est remis à son destinataire réel** : un
e-mail envoyé à `pdg@grandclient.com` finit dans l'interface, pas dans sa
boîte. (Mailpit sait aussi relayer ou transférer des messages vers un vrai
serveur SMTP - des modes comme `--smtp-relay-all` existent - mais
uniquement si vous les configurez explicitement.) C'est toute la différence
avec un « mode sandbox » d'un fournisseur d'envoi - il n'y a pas de compte,
pas de quota d'envoi ni de clé d'API à gérer.

## Lancer Mailpit

Mailpit est écrit en Go : c'est un binaire unique, sans dépendance. Via
Homebrew :

```bash
brew install mailpit
mailpit
```

(Pour les autres OS, vous pouvez téléchargez le binaire pour Linux ou Windows depuis les
[releases GitHub](https://github.com/axllent/mailpit/releases).)

Ou via Docker, sans rien installer :

```bash
docker run --rm \
  -p 127.0.0.1:8025:8025 \
  -p 127.0.0.1:1025:1025 \
  axllent/mailpit:v1.30.6
```

Deux détails qui comptent dans cette commande. D'abord, le préfixe
`127.0.0.1:` : sans lui, Docker publie ces ports sur **toutes les
interfaces de l'hôte**, et vous exposez un serveur SMTP sans
authentification à tout votre réseau local. Ensuite, l'étiquette de
version : pour un projet réel, épinglez une release (`v1.30.6`) plutôt que de
suivre silencieusement `latest`.

Ouvrez `http://localhost:8025` : la boîte de réception est vide et n'attend
que vos bugs.

## Envoyer un e-mail

Aucune bibliothèque spéciale : Mailpit est un serveur SMTP standard, votre
code d'envoi habituel fonctionne tel quel. Il suffit de viser
`localhost:1025`.

{{< codetabs >}}
{{< tab >}}
```java
Properties props = new Properties();
props.put("mail.smtp.host", "localhost");
props.put("mail.smtp.port", "1025");

Session session = Session.getInstance(props);
MimeMessage message = new MimeMessage(session);
message.setFrom("noreply@monapp.local");
message.setRecipients(Message.RecipientType.TO, "alice@example.com");
message.setSubject("Bienvenue !");
message.setText("Votre compte est prêt.");

Transport.send(message);
```
{{< /tab >}}
{{< tab >}}
```python
import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "noreply@monapp.local"
msg["To"] = "alice@example.com"
msg["Subject"] = "Bienvenue !"
msg.set_content("Votre compte est prêt.")

with smtplib.SMTP("localhost", 1025) as smtp:
    smtp.send_message(msg)
```
{{< /tab >}}
{{< /codetabs >}}

Rechargez `localhost:8025` : le message est là, rendu comme dans un vrai
client mail.

## Dans un vrai projet

En pratique, on ne code pas le SMTP à la main : on configure le framework,
et uniquement pour l'environnement de développement.

### Spring Boot

`JavaMailSender` ne voit pas la différence - seule la configuration change :

```yaml {filename="application-dev.yml"}
spring:
  mail:
    host: localhost
    port: 1025
```

Le profil de production garde son vrai relais SMTP ; le profil de dev
n'enverra jamais rien à personne.

### Django

Même principe dans les settings de développement :

```python {filename="settings/dev.py"}
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "localhost"
EMAIL_PORT = 1025
```

Et pour Flask ou FastAPI, c'est identique : quelle que soit la bibliothèque
d'envoi (Flask-Mail, `fastapi-mail`...), pointez-la vers `localhost:1025` et
le tour est joué.

## Automatiser le lancement de Mailpit

Lancer `mailpit` à la main chaque matin, on l'oublie une fois sur deux - et
on perd dix minutes à comprendre pourquoi l'inscription « ne marche plus ».
Deux approches pour que l'outil fasse partie du projet plutôt que de votre
mémoire.

### Avec Docker Compose

Si le projet a déjà un `docker-compose.yml` pour la base de données, Mailpit
n'est qu'un service de plus :

```yaml {filename="docker-compose.yml"}
services:
  app:
    build: .
    environment:
      SMTP_HOST: mailpit   # pas "localhost" : chaque conteneur a le sien
      SMTP_PORT: 1025

  mailpit:
    image: axllent/mailpit:v1.30.6
    ports:
      - "127.0.0.1:8025:8025"
```

Attention au piège classique : depuis le conteneur applicatif,
`localhost:1025` désigne le conteneur applicatif lui-même. C'est le **nom
du service** - `mailpit:1025` - qui joint Mailpit sur le réseau Compose.
Du coup, le port SMTP n'a même pas besoin d'être publié sur l'hôte ; seule
l'interface web l'est, et sur `127.0.0.1` uniquement. (Si une appli lancée
hors Docker doit aussi envoyer des mails, ajoutez
`"127.0.0.1:1025:1025"`.)

Un `docker compose up -d` et toute la stack de dev - base, cache, faux
SMTP - démarre d'un coup. Le nouveau venu clone le dépôt, lance Compose, et
les e-mails sont déjà capturés. Côté stockage, Mailpit garde ses messages
dans une base SQLite et ne conserve par défaut que les 500 derniers. Avec
le conteneur de cet exemple, rien n'est persisté : supprimer le conteneur
supprime aussi la base - en dev comme en CI, c'est généralement exactement
ce qu'on veut (montez un volume et configurez le chemin de la base si vous
tenez à la garder).

### Avec Testcontainers

Pour les tests d'intégration, [Testcontainers](https://testcontainers.com/)
va plus loin : c'est le test lui-même qui démarre le conteneur - et
l'arrête à la fin. Les ports exposés par le conteneur (1025, 8025) sont
mappés sur des ports de l'hôte **attribués dynamiquement** : plus rien à
lancer avant `mvn test` ou `pytest`, et plus de collision quand deux builds
tournent en parallèle sur le même agent de CI, puisqu'aucun test n'a
besoin de s'approprier les ports 1025 ou 8025 de l'hôte.

{{< codetabs >}}
{{< tab >}}
```java
@Testcontainers
@SpringBootTest
class RegistrationEmailTest {

    @Container
    static GenericContainer<?> mailpit =
        new GenericContainer<>(DockerImageName.parse("axllent/mailpit:v1.30.6"))
            .withExposedPorts(1025, 8025);

    @DynamicPropertySource
    static void mailProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host", mailpit::getHost);
        registry.add("spring.mail.port", () -> mailpit.getMappedPort(1025));
    }

    static String mailpitApi() {
        return "http://" + mailpit.getHost() + ":" + mailpit.getMappedPort(8025);
    }

    // le test lui-même : voir la section suivante, en visant mailpitApi()
}
```
{{< /tab >}}
{{< tab >}}
```python
import pytest
from testcontainers.community.mailpit import MailpitContainer

@pytest.fixture(scope="session")
def mailpit():
    with MailpitContainer("axllent/mailpit:v1.30.6") as c:
        yield {
            "smtp_host": c.get_container_host_ip(),
            "smtp_port": c.get_exposed_smtp_port(),
            "api": c.get_base_api_url(),
        }
```
{{< /tab >}}
{{< /codetabs >}}

Côté dépendances : `org.testcontainers:junit-jupiter` en Java,
`pip install testcontainers[mailpit]` en Python. Le `MailpitContainer` de
l'exemple Python est un **module communautaire** de Testcontainers ; il en
existe aussi un côté Java, mais le `GenericContainer` ci-dessus fait la
même chose sans dépendre du module dédié. Dans tous les cas, la règle est
la même : les ports côté hôte étant dynamiques, injectez-les dans la
configuration du test (le `@DynamicPropertySource` côté Spring, la fixture
côté pytest) au lieu de coder quoi que ce soit en dur - et cela vaut aussi
pour l'API, d'où le `mailpitApi()` côté Java et le `get_base_api_url()`
côté Python.

Une mise en garde enfin. Le conteneur est `static` (et la fixture pytest
de portée `session`) : la même instance sert **tous** les tests, et
l'intégration JUnit 5 de Testcontainers n'est de toute façon pas prévue
pour l'exécution parallèle. La boîte de réception est donc une ressource
partagée : ne supposez ni qu'elle est vide, ni que vos messages y sont
seuls, ni dans quel ordre ils arrivent. La parade tient dans des
identifiants uniques par test - c'est justement l'objet de la section
suivante.

## Vérifier les e-mails - à la main, puis en CI

L'interface web suffit pour le développement au quotidien. Mais Mailpit
expose aussi une **API REST**, et c'est elle qui rend l'outil vraiment
intéressant : vos tests d'intégration peuvent vérifier qu'un e-mail est
parti, à qui, et avec quel contenu. (L'API sait faire bien plus - envoyer,
taguer, relayer des messages ; les exemples ci-dessous supposent qu'elle
n'est pas protégée par authentification, comme dans la configuration par
défaut.)

```bash
curl http://localhost:8025/api/v1/messages         # la liste des e-mails capturés
curl "http://localhost:8025/api/v1/search?query=to:alice@example.com"   # recherche
curl -X DELETE http://localhost:8025/api/v1/messages   # vider la boîte
```

Un test naïf ferait : déclencher l'action, lire `messages[0]`, vérifier le
sujet. Il passera sur votre machine et cassera en CI, pour deux raisons.
D'abord une **course** : l'application peut répondre à la requête HTTP
avant que l'e-mail ne soit arrivé jusqu'à Mailpit. Ensuite une **hypothèse
d'ordre** : `messages[0]` suppose qu'aucun autre test n'a envoyé de message
entre-temps. Le pattern robuste tient en trois points : des **données de
test uniques** (un destinataire `alice+<uuid>@...` par test - deux tests qui
écrivent au même destinataire redeviennent ambigus), une **recherche**
ciblée (l'API accepte `to:`, `from:`, `subject:`...), et une **attente avec
timeout**.

{{< codetabs >}}
{{< tab >}}
```java
private static final HttpClient HTTP = HttpClient.newHttpClient();

@Test
void welcomeEmailIsSent() {
    String recipient = "alice+" + UUID.randomUUID() + "@example.com";
    registrationService.register(recipient);

    // Awaitility (org.awaitility:awaitility) réessaie jusqu'au timeout
    await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
        JsonNode messages = searchMailpit("to:" + recipient);
        assertEquals(1, messages.size());
        assertEquals("Bienvenue !", messages.get(0).path("Subject").asText());
    });
}

private JsonNode searchMailpit(String query) throws Exception {
    return mailpitGet("/api/v1/search?query="
        + URLEncoder.encode(query, StandardCharsets.UTF_8)).path("messages");
}

private JsonNode mailpitGet(String path) throws Exception {
    // mailpitApi() avec Testcontainers ; "http://localhost:8025"
    // en local ou en CI à ports fixes
    HttpRequest req = HttpRequest.newBuilder(URI.create(mailpitApi() + path))
        .timeout(Duration.ofSeconds(1))   // borne chaque tentative de polling
        .build();
    HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
    if (res.statusCode() != 200) {
        throw new AssertionError("Mailpit returned HTTP " + res.statusCode());
    }
    return new ObjectMapper().readTree(res.body());
}
```
{{< /tab >}}
{{< tab >}}
```python
import os
import time
import uuid
import httpx

# avec Testcontainers, utilisez plutôt mailpit["api"] de la fixture
MAILPIT_API = os.environ.get("MAILPIT_API", "http://localhost:8025")

def wait_for_email(query: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{MAILPIT_API}/api/v1/search",
                          params={"query": query}, timeout=1.0)
            r.raise_for_status()
            messages = r.json()["messages"]
        except httpx.HTTPError:
            messages = []
        if messages:
            assert len(messages) == 1, f"{len(messages)} e-mails pour {query!r}"
            return messages[0]
        time.sleep(0.2)
    raise AssertionError(f"aucun e-mail trouvé pour {query!r}")

def test_welcome_email_is_sent(client):
    recipient = f"alice+{uuid.uuid4().hex}@example.com"
    client.post("/register", json={"email": recipient})

    email = wait_for_email(f'to:"{recipient}" subject:"Bienvenue !"')
    assert email["Subject"] == "Bienvenue !"
```
{{< /tab >}}
{{< /codetabs >}}

Trois détails dans ces exemples. Le destinataire unique garantit que la
recherche renvoie exactement un message - et on l'affirme (`assertEquals(1,
...)`) au lieu de prendre le premier venu. La requête HTTP de polling a son
propre timeout court (`.timeout(...)` sur le `HttpRequest`, `timeout=1.0`
côté httpx) : sans lui, un Mailpit injoignable ferait pendre une requête
au-delà du délai global du test. Enfin, ne supposez pas des clés JSON en
minuscules (`subject`, `id`) - fiez-vous au schéma réellement renvoyé par
Mailpit (`Subject`, `From`, `To`, `ID`...), et parsez le JSON plutôt que de
chercher une sous-chaîne dans la réponse brute.

### Vérifier le contenu, pas seulement le sujet

La liste et la recherche ne renvoient qu'un résumé de chaque message. Pour
le corps - texte, HTML, en-têtes, pièces jointes -, interrogez
`GET /api/v1/message/{ID}` avec l'`ID` trouvé à l'étape précédente :

{{< codetabs >}}
{{< tab >}}
```java
// `email` = le message trouvé à l'étape précédente (messages.get(0))
JsonNode detail = mailpitGet("/api/v1/message/" + email.path("ID").asText());

assertEquals(recipient, detail.path("To").get(0).path("Address").asText());
assertTrue(detail.path("Text").asText().contains("Votre compte est prêt"));
```
{{< /tab >}}
{{< tab >}}
```python
# `email` = le message renvoyé par wait_for_email() à l'étape précédente
detail = httpx.get(f"{MAILPIT_API}/api/v1/message/{email['ID']}").json()

assert detail["To"][0]["Address"] == recipient
assert "Votre compte est prêt" in detail["Text"]
```
{{< /tab >}}
{{< /codetabs >}}

Pensez enfin à vider la boîte (`DELETE /api/v1/messages`) entre deux tests :
la recherche ciblée protège de l'ordre des messages, pas d'une boîte qui
gonfle indéfiniment quand tous les tests partagent la même instance.

### Dans le pipeline

Sous GitHub Actions, Mailpit se déclare comme un simple service Docker à
côté de la base de données :

```yaml {filename=".github/workflows/tests.yml"}
jobs:
  tests:
    runs-on: ubuntu-latest
    services:
      mailpit:
        image: axllent/mailpit:v1.30.6
        ports:
          - 1025:1025
          - 8025:8025
    env:
      SMTP_HOST: localhost
      SMTP_PORT: "1025"
    steps:
      # checkout, installation du JDK ou de Python, puis les tests
```

Le job tourne ici directement sur le runner, donc le service est joignable
sur `localhost` - d'où les variables d'environnement. Si vos steps
s'exécutent dans un conteneur (`container:`), remplacez `localhost` par le
nom du service, `mailpit` : même logique que dans Compose. Les mêmes tests
tournent alors en local et en CI, sans aucune bascule de configuration. Et
si vos tests utilisent déjà Testcontainers, ce bloc `services` devient
superflu : un runner avec Docker suffit, le test démarre son propre
Mailpit.

## Et les alternatives ?

MailHog rendait le même service mais est aujourd'hui beaucoup moins actif ;
Mailpit est une alternative moderne qui s'en inspire et reprend notamment
ses ports 1025 (SMTP) et 8025 (HTTP) - ce qui facilite le remplacement -
en ajoutant la recherche, un serveur POP3, la vérification HTML, le spam
testing (via SpamAssassin), les webhooks ou encore le chaos testing. Côté
Node, MailDev joue le même rôle si votre équipe préfère un outil npm à un
binaire Go. Le principe - et la configuration côté application - reste
identique dans les trois cas.

> Un e-mail de test qui part chez un vrai utilisateur est un bug qu'on ne
> pardonne pas. Mailpit transforme « croiser les doigts » en « ouvrir
> `localhost:8025` » : par défaut, tout est capturé et rien n'est délivré,
> et l'API REST rend la vérification automatisable jusqu'en CI.
