---
title: "Mailpit: test your e-mails in Java and Python"
date: 2026-08-23T15:21:41+02:00
tags: [tools]
banner: /images/posts/mailpit-java-python/banner.png
featured: true
draft: false
summary: "A fake SMTP server with a real inbox: Mailpit captures your app's e-mails instead of delivering them. Configuration on the Java and Python side, verification by hand and then in CI thanks to its REST API."
---

*"Spam without remorse: here, no e-mail ever reaches a real recipient."*

Many projects end up sending e-mails (sign-up, forgotten password, invoice,
and so on). E-mail remains the most common way to notify your users.
And every developer eventually asks the same question:
how do I test this without reaching real users? The classic answers
are all bad: commenting out the send call, redirecting everything to
your own Gmail inbox with `+test` aliases, or worse, crossing your fingers
and watching the logs. Bad, because they all violate a fundamental principle: you don't modify a package between testing and going to production. What was validated must be what gets deployed (some will recognize the principle of package immutability, also summed up as "Build once, deploy anywhere").

Mailpit solves the problem with a simple idea: a **capture SMTP
server**, bundled with a web interface and a REST API. Your
application talks to it like a real mail server, it intercepts everything,
and nothing ever leaves for the outside world.

And with respect to our package immutability principle, the difference between testing (with Mailpit) and production (with a production SMTP server) boils down to a configuration change (as if we were dealing with different servers on different environments).

## A fake SMTP server, a real inbox

Mailpit listens on two ports:

- **1025**: the SMTP server. Point your application at it; in its
  default configuration, it requires neither authentication nor encryption
  (both exist as options if you want to test that path too).
- **8025**: the web interface and the REST API. Every captured e-mail
  shows up there in real time, with its HTML rendering, its text
  version, its headers and its attachments.

By default, **no message is delivered to its real recipient**: an
e-mail sent to `ceo@bigcustomer.com` ends up in the interface, not in their
inbox. (Mailpit can also relay or forward messages to a real
SMTP server - modes like `--smtp-relay-all` exist - but
only if you configure them explicitly.) That's the whole difference
from a sending provider's "sandbox mode" - there is no account,
no sending quota and no API key to manage.

## Running Mailpit

Mailpit is written in Go: it's a single binary, with no dependencies.

On macOS, it goes through
Homebrew:

```bash
brew install mailpit
mailpit
```

You can also go through Docker, without installing anything:

```bash
docker run --rm \
  -p 127.0.0.1:8025:8025 \
  -p 127.0.0.1:1025:1025 \
  axllent/mailpit:v1.30.6
```

{{<nb title="Nota bene">}}
 Two important details in this command. First, the `127.0.0.1:` prefix: without it, Docker publishes these ports on **all of the host's interfaces**, and you expose an unauthenticated SMTP server to your entire local network. Second, the version tag: for a real project, pin a release (`v1.30.6`) rather than silently following `latest`.
{{</nb>}}

For other operating systems, you can download the binary for Linux or Windows from the
[GitHub releases](https://github.com/axllent/mailpit/releases).

Then open `http://localhost:8025`: the inbox is empty and only waiting
for your test e-mails.

## Sending an e-mail

No special library needed: Mailpit is a standard SMTP server, your
usual sending code works as is. Just aim at
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
        message.setFrom("noreply@myapp.local");
        message.setRecipients(Message.RecipientType.TO, "alice@example.com");
        message.setSubject("Welcome!");
        message.setText("Your account is ready.");

        Transport.send(message);

        System.out.println("Example 1: e-mail sent to Mailpit via localhost:1025");
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
    msg["From"] = "noreply@myapp.local"
    msg["To"] = "alice@example.com"
    msg["Subject"] = "Welcome!"
    msg.set_content("Your account is ready.")

    with smtplib.SMTP("localhost", 1025) as smtp:
        smtp.send_message(msg)

if __name__ == "__main__":
    main()
```
{{< /tab >}}
{{< /codetabs >}}

Reload `localhost:8025`: the message is there, rendered like in a real
mail client.

## In a real project

In general, you don't write the SMTP part (unless you're writing a script or a batch job, for instance): you configure your application's framework instead.

### Spring Boot

`JavaMailSender` doesn't see the difference - only the configuration changes:

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

The production profile keeps its real SMTP relay; the dev profile
will never send anything to anyone.

### Django

Same principle in the development settings:

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

And it's the same with Flask, whatever the sending library
(Flask-Mail, etc.), point it at `localhost:1025` and
you're done.

## Automating the Mailpit startup

Starting `mailpit` by hand, for every test run, is rather tedious, you can be sure
to forget it every other time.
Here are two approaches to make the tool part of the project rather than part of your
memory.

### With Docker Compose

If the project already has a `compose.yml` (to run the application in a Docker container, for example), you can
add Mailpit as one more service:

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

{{<warning title="Beware of the classic trap">}}
don't use `localhost` to reach Mailpit from the `app` application container, `localhost` refers to the application container itself.
Use the **service name** `mailpit` instead, and Compose will take care of wiring the
services together (a bit like a DNS on your local network).

By the way, Compose magic again: you'll notice that the SMTP port doesn't even need to be published on the host; only Mailpit's web interface is, and on `127.0.0.1` only.

If, however, you needed an app, running outside this Docker stack, to be able to send mail too, you would have to add `"127.0.0.1:1025:1025"` to the mailpit service's port list.
{{</warning>}}


One `docker compose up -d` and you're done, the whole dev stack starts in one go.

On the storage side, Mailpit keeps its messages
in a SQLite database and only retains the latest 500 by default. With
the container from this example, nothing is persisted: removing the container
also removes the database, in dev as in CI, that's usually exactly
what you want (mount a volume and configure the database path if you
really want to keep it).

### With Testcontainers

For integration tests, [Testcontainers](https://testcontainers.com/)
lets you go further: the test itself starts the container, and
stops it at the end. The ports exposed by the container (1025, 8025) are
mapped to **dynamically assigned** host ports: nothing left to
start before `mvn test` or `pytest`, and no more collisions when two builds
run in parallel on the same CI agent, since no test needs
to claim the host's ports 1025 or 8025 for itself.

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

On the dependency side, it's simple: `org.testcontainers:junit-jupiter` in Java,
`testcontainers[mailpit]` in Python. The `MailpitContainer` in the
Python example is a Testcontainers **community module**; one also
exists on the Java side, but the `GenericContainer` above does the
same thing without depending on the dedicated module. Either way, the rule is
the same: since the host-side ports are dynamic, inject them into the
test configuration (with `@DynamicPropertySource` on the Spring side, or the fixture
on the pytest side) instead of hard-coding anything - and that also holds
for the API, hence the `mailpitApi()` on the Java side and the `get_base_api_url()`
on the Python side.

{{<warning title="A small word of caution">}}
The container is `static` (and the pytest fixture
is `session`-scoped): this means a single instance serves **all** the tests, and
Testcontainers' JUnit 5 integration isn't designed
for parallel execution anyway. The inbox is therefore a
shared resource. A piece of advice: don't assume it is empty, nor that your messages are
alone in it, nor in what order they arrive. The remedy lies in
unique identifiers per test - which is precisely the point of the next
section.
{{</warning>}}

## Verifying e-mails, by hand, then in CI

The web interface is enough for day-to-day development. But Mailpit goes further and
also exposes a **REST API**, and that's what makes the tool truly
interesting: your integration tests can verify that an e-mail was
sent, to whom, and with what content. (The API can do a lot more (send,
tag, relay messages). The examples below assume it is
not protected by authentication, as in the default
configuration.)

```bash
# List the e-mails received by Mailpit
curl http://localhost:8025/api/v1/messages

# Search for e-mails
curl "http://localhost:8025/api/v1/search?query=to:alice@example.com"

# Empty the inbox
curl -X DELETE http://localhost:8025/api/v1/messages
```

Thanks to this REST API, we can then write a test that sends an e-mail to a recipient, then runs a
targeted search for the e-mail with a wait (paired with a timeout, so we don't wait for the e-mail forever).

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
        assertEquals("Welcome!", messages.get(0).path("Subject").asText());
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
            assert len(messages) == 1, f"{len(messages)} e-mails for {query!r}"
            return messages[0]
        time.sleep(0.2)
    raise AssertionError(f"no e-mail found for {query!r}")

def test_welcome_email_is_sent(client):
    recipient = f"alice+{uuid.uuid4().hex}@example.com"
    client.post("/register", json={"email": recipient})

    email = wait_for_email(f'to:"{recipient}" subject:"Welcome!"')
    assert email["Subject"] == "Welcome!"
```
{{< /tab >}}
{{< /codetabs >}}

{{<nb>}}
Three details in these examples:
1. The unique recipient (using a UUID) guarantees that the
search returns exactly one message, and we verify it (`assertEquals(1,
...)`) instead of grabbing the first one that comes along.
2. The polling HTTP request has its
own short timeout (`.timeout(...)` on the `HttpRequest`, `timeout=1.0`
on the httpx side): without it, an unreachable Mailpit would make a request hang
beyond the test's global deadline.
3. Finally, don't assume lowercase JSON keys
(`subject`, `id`), trust the schema Mailpit actually returns
(`Subject`, `From`, `To`, `ID`, etc.), and ~for pity's sake~ parse the JSON instead of
looking for a substring in the raw response.
{{</nb>}}

### Verifying the content, not just the subject

The list and search endpoints only return a summary of each message. For
the full content (text, HTML, headers, attachments), query
`GET /api/v1/message/{ID}` with the `ID` found in the previous step:

{{< codetabs >}}
{{< tab >}}
```java
JsonNode detail = mailpitGet("/api/v1/message/" + email.path("ID").asText());

assertEquals(recipient, detail.path("To").get(0).path("Address").asText());
assertTrue(detail.path("Text").asText().contains("Your account is ready"));
```
{{< /tab >}}
{{< tab >}}
```python
detail = httpx.get(f"{MAILPIT_API}/api/v1/message/{email['ID']}").json()

assert detail["To"][0]["Address"] == recipient
assert "Your account is ready" in detail["Text"]
```
{{< /tab >}}
{{< /codetabs >}}

Finally, remember to empty the inbox (`DELETE /api/v1/messages`) between two test runs:
the targeted search protects you from message ordering, not from an inbox that
swells indefinitely when all the tests share the same instance.

### In a GitHub Actions pipeline

Under GitHub Actions, Mailpit is declared as a plain Docker service:

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

Here the job runs directly on the runner, so the service is reachable
on `localhost` (hence the environment variables). If your steps
run inside a container (`container:`), replace `localhost` with the
service name `mailpit` (same logic as in Compose). The same tests
then run locally and in CI, without any configuration switch.

And if your tests already use Testcontainers, this `services` block becomes
superfluous: a runner with Docker is enough, the test starts its own
Mailpit.

## What about the alternatives?

MailHog provided the same service but is much less active nowadays;
Mailpit is a modern alternative inspired by it that notably reuses
its ports 1025 (SMTP) and 8025 (HTTP) (which makes swapping easy)
while adding search, a POP3 server, HTML checking, spam
testing (via SpamAssassin), webhooks and even chaos testing.

On the NodeJS side, MailDev plays the same role, so if your team prefers an npm tool to a
Go binary. The principle (and the application-side configuration) remains broadly the same.

> A test e-mail that lands in a real user's inbox is a bug nobody
> forgives (what do you think, Cédric from Crédit Agricole?).
>
> Mailpit turns "crossing your fingers" into "opening `localhost:8025`": by default,
> everything is captured and nothing is delivered,
> and the REST API makes verification automatable all the way into CI.
