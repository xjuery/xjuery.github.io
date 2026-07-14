---
title: "MailDev: test your emails in Java and Python"
date: 2026-07-13T15:21:41+02:00
tags: [tools]
featured: false
draft: true
summary: "A fake SMTP server with a real inbox: MailDev captures every email your app sends. Setup for Java and Python, then manual and CI verification through its REST API."
---

*« Spammez sans remords : ici, aucun e-mail ne quitte votre machine. »*

Every project ends up sending emails — sign-ups, password resets, invoices.
And every developer ends up asking the same question: how do I test this
without spraying real users? The classic answers are all bad: comment out
the send call, redirect everything to your own Gmail with `+test` aliases,
or worse, cross your fingers and watch the logs.

MailDev solves this with one simple idea: a **local SMTP server that never
delivers anything**. Your application talks to it like a real mail server,
it captures everything, and you read the messages back in a web interface.

## A fake SMTP server, a real inbox

MailDev listens on two ports:

- **1025** — the SMTP server. Point your application at it, no
  authentication and no TLS required.
- **1080** — the web interface. Every captured email shows up there in real
  time, with its HTML rendering, plain-text version, headers, and
  attachments.

Nothing ever leaves your machine: an email addressed to
`ceo@bigcustomer.com` lands in the interface, not in their inbox. That is
the whole difference with a mail provider's "sandbox mode" — there is no
account, no quota, and no API key to protect.

## Running MailDev

Two options, take your pick. Via npm:

```bash
npm install -g maildev
maildev
```

Or via Docker, with nothing to install:

```bash
docker run --rm -p 1080:1080 -p 1025:1025 maildev/maildev
```

Open `http://localhost:1080`: the inbox is empty and waiting for your bugs.

## Sending an email

No special library needed: MailDev is a standard SMTP server, so your usual
sending code works as-is. Just aim it at `localhost:1025`.

{{< codetabs >}}
{{< tab >}}
```java
Properties props = new Properties();
props.put("mail.smtp.host", "localhost");
props.put("mail.smtp.port", "1025");

Session session = Session.getInstance(props);
MimeMessage message = new MimeMessage(session);
message.setFrom("noreply@myapp.local");
message.setRecipients(Message.RecipientType.TO, "alice@example.com");
message.setSubject("Welcome!");
message.setText("Your account is ready.");

Transport.send(message);
```
{{< /tab >}}
{{< tab >}}
```python
import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "noreply@myapp.local"
msg["To"] = "alice@example.com"
msg["Subject"] = "Welcome!"
msg.set_content("Your account is ready.")

with smtplib.SMTP("localhost", 1025) as smtp:
    smtp.send_message(msg)
```
{{< /tab >}}
{{< /codetabs >}}

Reload `localhost:1080`: the message is there, rendered like in a real mail
client.

## In a real project

In practice you don't hand-roll SMTP: you configure the framework, and only
for the development environment.

### Spring Boot

`JavaMailSender` can't tell the difference — only the configuration
changes:

```yaml {filename="application-dev.yml"}
spring:
  mail:
    host: localhost
    port: 1025
```

The production profile keeps its real SMTP relay; the dev profile will
never send anything to anyone.

### Django

Same principle in the development settings:

```python {filename="settings/dev.py"}
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "localhost"
EMAIL_PORT = 1025
```

Flask and FastAPI work the same way: whatever the sending library
(Flask-Mail, `fastapi-mail`…), point it at `localhost:1025` and you're
done.

## Checking emails — by hand, then in CI

The web interface is enough for day-to-day development. But MailDev also
exposes a **REST API**, and that is what makes the tool genuinely
interesting: your integration tests can verify that an email went out, to
whom, and with what content.

```bash
curl http://localhost:1080/email          # the list of captured emails
curl -X DELETE http://localhost:1080/email/all   # empty the inbox
```

An integration test becomes trivial: trigger the action, then query
MailDev.

{{< codetabs >}}
{{< tab >}}
```java
@Test
void welcomeEmailIsSent() throws Exception {
    registrationService.register("alice@example.com");

    HttpResponse<String> res = HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(URI.create("http://localhost:1080/email")).build(),
        HttpResponse.BodyHandlers.ofString());

    assertTrue(res.body().contains("\"subject\":\"Welcome!\""));
}
```
{{< /tab >}}
{{< tab >}}
```python
import httpx

def test_welcome_email_is_sent(client):
    client.post("/register", json={"email": "alice@example.com"})

    emails = httpx.get("http://localhost:1080/email").json()
    assert emails[-1]["subject"] == "Welcome!"
```
{{< /tab >}}
{{< /codetabs >}}

Remember to empty the inbox (`DELETE /email/all`) between tests so you
don't read the previous test's messages.

### In the pipeline

On GitHub Actions, MailDev is declared as a plain Docker service next to
the database:

```yaml {filename=".github/workflows/tests.yml"}
services:
  maildev:
    image: maildev/maildev
    ports:
      - 1025:1025
      - 1080:1080
```

The same tests then run locally and in CI, with no configuration switch at
all.

## What about the alternatives?

MailHog offered the same service but is no longer maintained; Mailpit,
written in Go, is its spiritual successor and worth a look if you prefer a
single binary over a Node tool. The principle — and the application-side
configuration — is identical in all three cases.

> A test email that reaches a real user is a bug nobody forgives. MailDev
> turns "cross your fingers" into "open `localhost:1080`": everything is
> captured, nothing gets out, and the REST API makes verification
> automatable all the way into CI.
