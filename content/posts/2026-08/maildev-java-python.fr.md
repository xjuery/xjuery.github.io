---
title: "MailDev : testez vos e-mails en Java et en Python"
date: 2026-08-16T15:21:41+02:00
tags: [tools]
featured: false
draft: true
summary: "Un faux serveur SMTP avec une vraie boîte de réception : MailDev capture tous les e-mails de votre appli. Configuration côté Java et Python, vérification à la main puis en CI grâce à son API REST."
---

*« Spammez sans remords : ici, aucun e-mail ne quitte votre machine. »*

Tout projet finit par envoyer des e-mails — inscription, mot de passe
oublié, facture. Et tout développeur finit par se poser la même question :
comment tester ça sans arroser de vrais utilisateurs ? Les réponses
classiques sont toutes mauvaises : commenter l'appel d'envoi, rediriger vers
sa propre boîte Gmail à coups d'alias `+test`, ou pire, croiser les doigts
et regarder les logs.

MailDev règle le problème avec une idée simple : un **serveur SMTP local
qui ne délivre rien**. Votre application lui parle comme à un vrai serveur
de mail, il capture tout, et vous relisez les messages dans une interface
web.

## Un faux SMTP, une vraie boîte de réception

MailDev écoute sur deux ports :

- **1025** — le serveur SMTP. Pointez-y votre application, sans
  authentification ni TLS.
- **1080** — l'interface web. Chaque e-mail capturé y apparaît en temps
  réel, avec son rendu HTML, sa version texte, ses en-têtes et ses pièces
  jointes.

Rien ne quitte jamais votre machine : un e-mail envoyé à
`pdg@grandclient.com` finit dans l'interface, pas dans sa boîte. C'est
toute la différence avec un « mode sandbox » d'un fournisseur d'envoi — il
n'y a pas de compte, pas de quota, pas de clé d'API à protéger.

## Lancer MailDev

Deux options, au choix. Via npm :

```bash
npm install -g maildev
maildev
```

Ou via Docker, sans rien installer :

```bash
docker run --rm -p 1080:1080 -p 1025:1025 maildev/maildev
```

Ouvrez `http://localhost:1080` : la boîte de réception est vide et n'attend
que vos bugs.

## Envoyer un e-mail

Aucune bibliothèque spéciale : MailDev est un serveur SMTP standard, votre
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

Rechargez `localhost:1080` : le message est là, rendu comme dans un vrai
client mail.

## Dans un vrai projet

En pratique, on ne code pas le SMTP à la main : on configure le framework,
et uniquement pour l'environnement de développement.

### Spring Boot

`JavaMailSender` ne voit pas la différence — seule la configuration change :

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
d'envoi (Flask-Mail, `fastapi-mail`…), pointez-la vers `localhost:1025` et
le tour est joué.

## Automatiser le lancement de MailDev

Lancer `maildev` à la main chaque matin, on l'oublie une fois sur deux — et
on perd dix minutes à comprendre pourquoi l'inscription « ne marche plus ».
Deux approches pour que l'outil fasse partie du projet plutôt que de votre
mémoire.

### Avec Docker Compose

Si le projet a déjà un `docker-compose.yml` pour la base de données, MailDev
n'est qu'un service de plus :

```yaml {filename="docker-compose.yml"}
services:
  maildev:
    image: maildev/maildev
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "1080:1080"
```

Un `docker compose up -d` et toute la stack de dev — base, cache, faux
SMTP — démarre d'un coup. C'est l'option la plus simple pour
l'environnement de développement partagé par l'équipe : le nouveau venu
clone le dépôt, lance Compose, et les e-mails sont déjà capturés.

### Avec Testcontainers

Pour les tests d'intégration, [Testcontainers](https://testcontainers.com/)
va plus loin : c'est le test lui-même qui démarre le conteneur — et
l'arrête à la fin — sur des ports aléatoires. Plus rien à lancer avant
`mvn test` ou `pytest`, et plus de collision de ports quand deux builds
tournent en parallèle sur le même agent de CI.

{{< codetabs >}}
{{< tab >}}
```java
@Testcontainers
@SpringBootTest
class RegistrationEmailTest {

    @Container
    static GenericContainer<?> maildev =
        new GenericContainer<>("maildev/maildev")
            .withExposedPorts(1025, 1080);

    @DynamicPropertySource
    static void mailProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host", maildev::getHost);
        registry.add("spring.mail.port", () -> maildev.getMappedPort(1025));
    }

    @Test
    void welcomeEmailIsSent() {
        // même test que plus bas, en interrogeant l'API REST sur
        // "http://" + maildev.getHost() + ":" + maildev.getMappedPort(1080)
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
import pytest
from testcontainers.core.container import DockerContainer

@pytest.fixture(scope="session")
def maildev():
    with DockerContainer("maildev/maildev").with_exposed_ports(1025, 1080) as c:
        host = c.get_container_host_ip()
        yield {
            "smtp_host": host,
            "smtp_port": int(c.get_exposed_port(1025)),
            "api": f"http://{host}:{c.get_exposed_port(1080)}",
        }
```
{{< /tab >}}
{{< /codetabs >}}

Côté dépendances : `org.testcontainers:junit-jupiter` en Java,
`pip install testcontainers` en Python. Comme les ports sont attribués
dynamiquement, injectez-les dans la configuration du test (le
`@DynamicPropertySource` ci-dessus côté Spring, la fixture côté pytest) au
lieu de coder `1025` en dur.

## Vérifier les e-mails — à la main, puis en CI

L'interface web suffit pour le développement au quotidien. Mais MailDev
expose aussi une **API REST**, et c'est elle qui rend l'outil vraiment
intéressant : vos tests d'intégration peuvent vérifier qu'un e-mail est
parti, à qui, et avec quel contenu.

```bash
curl http://localhost:1080/email          # la liste des e-mails capturés
curl -X DELETE http://localhost:1080/email/all   # vider la boîte
```

Un test d'intégration devient trivial : on déclenche l'action, puis on
interroge MailDev.

{{< codetabs >}}
{{< tab >}}
```java
@Test
void welcomeEmailIsSent() throws Exception {
    registrationService.register("alice@example.com");

    HttpResponse<String> res = HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(URI.create("http://localhost:1080/email")).build(),
        HttpResponse.BodyHandlers.ofString());

    assertTrue(res.body().contains("\"subject\":\"Bienvenue !\""));
}
```
{{< /tab >}}
{{< tab >}}
```python
import httpx

def test_welcome_email_is_sent(client):
    client.post("/register", json={"email": "alice@example.com"})

    emails = httpx.get("http://localhost:1080/email").json()
    assert emails[-1]["subject"] == "Bienvenue !"
```
{{< /tab >}}
{{< /codetabs >}}

Pensez à vider la boîte (`DELETE /email/all`) entre deux tests pour ne pas
lire les messages du test précédent.

### Dans le pipeline

Sous GitHub Actions, MailDev se déclare comme un simple service Docker à
côté de la base de données :

```yaml {filename=".github/workflows/tests.yml"}
services:
  maildev:
    image: maildev/maildev
    ports:
      - 1025:1025
      - 1080:1080
```

Les mêmes tests tournent alors en local et en CI, sans aucune bascule de
configuration. Et si vos tests utilisent déjà Testcontainers, ce bloc
`services` devient superflu : un runner avec Docker suffit, le test démarre
son propre MailDev.

## Et les alternatives ?

MailHog rendait le même service mais n'est plus maintenu ; Mailpit, écrit
en Go, est son successeur spirituel et vaut le coup d'œil si vous préférez
un binaire unique à un outil Node. Le principe — et la configuration côté
application — reste identique dans les trois cas.

> Un e-mail de test qui part chez un vrai utilisateur est un bug qu'on ne
> pardonne pas. MailDev transforme « croiser les doigts » en « ouvrir
> `localhost:1080` » : tout est capturé, rien ne sort, et l'API REST rend
> la vérification automatisable jusqu'en CI.
