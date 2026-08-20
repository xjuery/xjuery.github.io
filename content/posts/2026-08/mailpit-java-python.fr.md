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

Et par rapport à notre principe d'immutabilité des packages, la différence entre les tests (avec mailpit) et la mise en production (avec un serveur smtp de production) se résume à un changement de configuration (comme si on avait affaire à des serveurs différents sur des environnements différents).

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

Mailpit est écrit en Go : c'est un binaire unique, sans dépendance. 

Pour MacOS, cela se passe via
Homebrew :

```bash
brew install mailpit
mailpit
```

Vous pouvez aussi passer par Docker, sans rien installer :

```bash
docker run --rm \
  -p 127.0.0.1:8025:8025 \
  -p 127.0.0.1:1025:1025 \
  axllent/mailpit:v1.30.6
```

{{<nb title="Nota bene">}}
 Deux détails importants dans cette commande. D'abord, le préfixe `127.0.0.1:` : sans lui, Docker publie ces ports sur **toutes les interfaces de l'hôte**, et vous exposez un serveur SMTP sans authentification à tout votre réseau local. Ensuite, l'étiquette de version : pour un projet réel, épinglez une release (`v1.30.6`) plutôt que de suivre silencieusement `latest`.
{{</nb>}}

Pour les autres OS, vous pouvez téléchargez le binaire pour Linux ou Windows depuis les
[releases GitHub](https://github.com/axllent/mailpit/releases).

Ensuite, ouvrez `http://localhost:8025` : la boîte de réception est vide et n'attend
que vos emails de test.

## Envoyer un e-mail

Aucune bibliothèque spéciale : Mailpit est un serveur SMTP standard, votre
code d'envoi habituel fonctionne tel quel. Il suffit de viser
`localhost:1025`.

{{< codetabs >}}
{{< tab >}}
```java
package fr.juery;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.MimeMessage;

import java.util.Properties;

public class Example01SendEmail {

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put("mail.smtp.host", "localhost");
        props.put("mail.smtp.port", "1025");

        Session session = Session.getInstance(props);
        MimeMessage message = new MimeMessage(session);
        message.setFrom("noreply@monapp.local");
        message.setRecipients(Message.RecipientType.TO, "alice@example.com");
        message.setSubject("Welcome !");
        message.setText("Your account is ready.");

        Transport.send(message);

        System.out.println("Example 1: email sent to Mailpit via localhost:1025");
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
import smtplib
from email.message import EmailMessage

def main():
    msg = EmailMessage()
    msg["From"] = "noreply@monapp.local"
    msg["To"] = "alice@example.com"
    msg["Subject"] = "Welcome !"
    msg.set_content("Your account is ready.")

    with smtplib.SMTP("localhost", 1025) as smtp:
        smtp.send_message(msg)

if __name__ == "__main__":
    main()
```
{{< /tab >}}
{{< /codetabs >}}

Rechargez `localhost:8025` : le message est là, rendu comme dans un vrai
client mail.

## Dans un vrai projet

En général, on ne code pas le SMTP à la main (sauf si on est dans le cas d'un script ou un batch, par exemple) : on configure plutôt le framework de notre application.

### Spring Boot

`JavaMailSender` ne voit pas la différence - seule la configuration change :

{{< codetabs >}}
{{< tab Development >}}
```yaml
spring:
  mail:
    host: localhost
    port: 1025
```
{{< /tab >}}
{{< tab Production >}}
```yaml
spring:
  mail:
    host: YOURSMTPSERVER
    port: 587
    username: ${MAIL_USERNAME}
    password: ${MAIL_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
          ssl:
            trust: YOURSMTPSERVER
          connectiontimeout: 5000
          timeout: 5000
          writetimeout: 5000
```
{{< /tab >}}
{{< /codetabs >}}

Le profil de production garde son vrai relais SMTP ; le profil de dev
n'enverra jamais rien à personne.

### Django

Même principe dans les settings de développement :

{{< codetabs >}}
{{< tab Development >}}
```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "localhost"
EMAIL_PORT = 1025
```
{{< /tab >}}
{{< tab Production >}}
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_HOST = 'YOURSMTPSERVER'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False

EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')

DEFAULT_FROM_EMAIL = 'Your App Name <noreply@yourdomain.com>'
SERVER_EMAIL = 'noreply@yourdomain.com'

EMAIL_TIMEOUT = 10
```
{{< /tab >}}
{{< /codetabs >}}

Et pour Flask, c'est identique : quelle que soit la bibliothèque
d'envoi (Flask-Mail, etc.), pointez-la vers `localhost:1025` et
le tour est joué.

## Automatiser le lancement de Mailpit

Lancer `mailpit` à la main, à chaque tests, est assez fastidieux, vous pouvez être sûr de l'oublier une fois 
sur deux.
Voici deux approches pour que l'outil fasse partie du projet plutôt que de votre
mémoire.

### Avec Docker Compose

Si le projet a déjà un `compose.yml` (pour lancer l'application dans un conteneur Docker, par exemple), vous pouvez 
ajouter Mailpit comme un service en plus :

```yaml {filename="compose.yml"}
services:
  app:
    build: .
    environment:
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
    ports:
      - "8080:8080"

  mailpit:
    image: axllent/mailpit:v1.30.6
    ports:
      - "127.0.0.1:8025:8025"
```

{{<warning title="Attention au piège classique">}}
n'utilisez pas `localhost` pour joindre MailPit à partir du conteneur applicatif `app`, `localhost` désigne le conteneur applicatif lui-même. 
Il faut plutôt utiliser le **nom du service** `mailpit`, et c'est Compose qui s'occupera de faire le lien entre les
services (un peu à la manière d'un DNS sur votre reseau local).

D'ailleurs, encore la magie de Compose, vous remarquerez que le port SMTP n'a même pas besoin d'être publié sur l'hôte ; seule l'interface web de MailPit l'est, et sur `127.0.0.1` uniquement.

Si toutefois, vous aviez besoin qu'une appli, lancée en dehors de cette stack Docker, puisse aussi envoyer des mails, Il vous faudra ajouter `"127.0.0.1:1025:1025"` à la liste des ports du service mailpit.
{{</warning>}}


Un `docker compose up -d` et le tour est joué, toute la stack de dev démarre d'un coup. 

Côté stockage, Mailpit garde ses messages
dans une base SQLite et ne conserve par défaut que les 500 derniers. Avec
le conteneur de cet exemple, rien n'est persisté : supprimer le conteneur
supprime aussi la base - en dev comme en CI, c'est généralement exactement
ce qu'on veut (montez un volume et configurez le chemin de la base si vous
tenez à la garder).

### Avec Testcontainers

Pour les tests d'intégration, [Testcontainers](https://testcontainers.com/)
peut vous permettre d'aller plus loin : c'est le test lui-même qui démarre le conteneur, et
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

Côté dépendances, c'est simple : `org.testcontainers:junit-jupiter` en Java,
`testcontainers[mailpit]` en Python. Le `MailpitContainer` de
l'exemple Python est un **module communautaire** de Testcontainers ; il en
existe aussi un côté Java, mais le `GenericContainer` ci-dessus fait la
même chose sans dépendre du module dédié. Dans tous les cas, la règle est
la même : les ports côté hôte étant dynamiques, injectez-les dans la
configuration du test (avec le `@DynamicPropertySource` côté Spring, ou la fixture
côté pytest) au lieu de coder quoi que ce soit en dur - et cela vaut aussi
pour l'API, d'où le `mailpitApi()` côté Java et le `get_base_api_url()`
côté Python.

{{<warning title="Petite mise en garde">}}
Le conteneur est `static` (et la fixture pytest
de portée `session`) : cela signifie qu'une même instance sert **tous** les tests, et
l'intégration JUnit 5 de Testcontainers n'est de toute façon pas prévue
pour l'exécution parallèle. La boîte de réception est donc une ressource
partagée. Un conseil : ne supposez ni qu'elle est vide, ni que vos messages y sont
seuls, ni dans quel ordre ils arrivent. La parade tient dans des
identifiants uniques par test, c'est justement l'objet de la section
suivante.
{{</warning>}}

## Vérifier les e-mails, à la main, puis en CI

L'interface web suffit pour le développement au quotidien. Mais Mailpit va plus loin et
expose aussi une **API REST**, c'est elle qui rend l'outil vraiment
intéressant : vos tests d'intégration peuvent vérifier qu'un e-mail est
parti, à qui, et avec quel contenu. (L'API sait faire bien plus - envoyer,
taguer, relayer des messages ; les exemples ci-dessous supposent qu'elle
n'est pas protégée par authentification, comme dans la configuration par
défaut.)

```bash
# List the emails received by MailPit
curl http://localhost:8025/api/v1/messages

# Search for emails
curl "http://localhost:8025/api/v1/search?query=to:alice@example.com"

# Empty the inbox
curl -X DELETE http://localhost:8025/api/v1/messages
```

Grâce à cette API REST, nous pouvons alors écrire un test qui envoie un email à un destinataire, puis fait une
Recherche ciblée de l'email avec une attente (à laquelle on adjoint un timeout, pour ne pas attendre l'email indéfiniment).

{{< codetabs >}}
{{< tab >}}
```java
private static final HttpClient HTTP = HttpClient.newHttpClient();

@Test
void welcomeEmailIsSent() {
    String recipient = "alice+" + UUID.randomUUID() + "@example.com";
    registrationService.register(recipient);

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
    HttpRequest req = HttpRequest.newBuilder(URI.create(mailpitApi() + path))
        .timeout(Duration.ofSeconds(1))
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

{{<nb>}}
Trois détails dans ces exemples:
1. Le destinataire unique (avec utilisation d'un UUID) garantit que la
recherche renvoie exactement un message, et on le vérifie (`assertEquals(1,
...)`) au lieu de prendre le premier venu. 
2. La requête HTTP de polling a son
propre timeout court (`.timeout(...)` sur le `HttpRequest`, `timeout=1.0`
côté httpx) : sans lui, un Mailpit injoignable ferait pendre une requête
au-delà du délai global du test. 
3. Enfin, ne supposez pas des clés JSON en
minuscules (`subject`, `id`), fiez-vous au schéma réellement renvoyé par
Mailpit (`Subject`, `From`, `To`, `ID`, etc.), et ~par pitié~ parsez le JSON plutôt que de
chercher une sous-chaîne dans la réponse brute.
{{</nb>}}

### Vérifier le contenu, pas seulement le sujet

La liste et la recherche ne renvoient qu'un résumé de chaque message. Pour
le ccontenu complet (texte, HTML, en-têtes, pièces jointes), interrogez
`GET /api/v1/message/{ID}` avec l'`ID` trouvé à l'étape précédente :

{{< codetabs >}}
{{< tab >}}
```java
JsonNode detail = mailpitGet("/api/v1/message/" + email.path("ID").asText());

assertEquals(recipient, detail.path("To").get(0).path("Address").asText());
assertTrue(detail.path("Text").asText().contains("Votre compte est prêt"));
```
{{< /tab >}}
{{< tab >}}
```python
detail = httpx.get(f"{MAILPIT_API}/api/v1/message/{email['ID']}").json()

assert detail["To"][0]["Address"] == recipient
assert "Votre compte est prêt" in detail["Text"]
```
{{< /tab >}}
{{< /codetabs >}}

Pensez enfin à vider la boîte (`DELETE /api/v1/messages`) entre deux tests :
la recherche ciblée protège de l'ordre des messages, pas d'une boîte qui
gonfle indéfiniment quand tous les tests partagent la même instance.

### Dans un pipeline Github Actions

Sous GitHub Actions, Mailpit se déclare comme un simple service Docker :

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
    ...
```

Le job tourne ici directement sur le runner, donc le service est joignable
sur `localhost` (d'où les variables d'environnement). Si vos steps
s'exécutent dans un conteneur (`container:`), remplacez `localhost` par le
nom du service `mailpit` (même logique que dans Compose). Les mêmes tests
tournent alors en local et en CI, sans aucune bascule de configuration. 

Et si vos tests utilisent déjà Testcontainers, ce bloc `services` devient
superflu : un runner avec Docker suffit, le test démarre son propre
Mailpit.

## Et les alternatives ?

MailHog rendait le même service mais est aujourd'hui beaucoup moins actif ;
Mailpit est une alternative moderne qui s'en inspire et reprend notamment
ses ports 1025 (SMTP) et 8025 (HTTP) (ce qui facilite le remplacement)
en ajoutant la recherche, un serveur POP3, la vérification HTML, le spam
testing (via SpamAssassin), les webhooks ou encore le chaos testing. 

Côté NodeJS, MailDev joue le même rôle si votre équipe préfère un outil npm à un
binaire Go. Le principe (et la configuration côté application) reste globalement identique.

> Un e-mail de test qui part chez un vrai utilisateur est un bug qu'on ne
> pardonne pas (n'est-ce pas Cédric de Crédit Agricole ?). 
>
> Mailpit transforme « croiser les doigts » en « ouvrir `localhost:8025` » : par défaut, 
> tout est capturé et rien n'est délivré,
> et l'API REST rend la vérification automatisable jusqu'en CI.
