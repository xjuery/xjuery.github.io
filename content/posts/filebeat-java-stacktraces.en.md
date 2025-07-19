---
title: "Filebeat & Java stacktraces"
date: 2025-07-19
draft: true
categories: ["Elastic"]
tags: ["elastic", "filebeat"]
autor: "Xavier JUERY"
---

## Parsing Multiline Logs with Filebeat

### 🔍 What is Filebeat?

**Filebeat** is a lightweight agent developed by **Elastic** that reads log files and sends them to a destination such as **Logstash**, **Elasticsearch**, or another analysis system. It is particularly useful in distributed environments to centrally collect logs.

Benefits :
- Lightweight and fast
- Easy to configure
- Native integration with the **Elastic Stack** (ELK)

### 🎯 Goal: Handle Multiline Logs

#### The Problem

In many applications, especially those written in **Java**, some errors like **stacktraces** span multiple lines:

```text
Exception in thread "main" java.lang.NullPointerException
	at com.example.myproject.Book.getTitle(Book.java:16)
	at com.example.myproject.Author.getBookTitles(Author.java:25)
	at com.example.myproject.Bootstrap.main(Bootstrap.java:14)
```

Without specific configuration, Filebeat sends each line as a separate event, which makes analysis in Elasticsearch or Kibana very difficult.

#### Solution: Multiline Configuration in Filebeat

Filebeat allows grouping multiple lines into a single event using a multiline rule.

⸻

🛠 Generic Filebeat Configuration Example for Multiline Logs

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

🧠 Explanation of this configuration:

| Paramètre | Description |
| --------- | ----------- |
| multiline.pattern | A regular expression that detects lines to append to the previous event. Here, ^\s matches a line starting with a space or tab (like the lines in a stack trace).|
| multiline.negate | If set to false, it means that lines matching the pattern (^\s) are continuations and should be concatenated with the previous line.|
| multiline.match | "after" means that the matching lines should be attached to the previous one.
|

#### 🔁 Variant: Line Starting with a Timestamp

If your Java logs start with a timestamp, you can reverse the logic:

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
This configuration means:

- Any line that does not start with a timestamp (like stack trace lines) is considered part of the previous line.


💡 Best Practices
- Test your regex before applying it. Use a tool like regex101.com.
- Limit the size of multiline events using close_inactive or max_bytes.
- Use the Filebeat Java module if available (in some Elastic distributions).
- Monitor Filebeat’s load when dealing with very verbose logs.

### Conclusion

Configuring Filebeat to handle multiline logs like Java stack traces is essential for ensuring the quality of your data in Elasticsearch. With the multiline directive, it is possible to correctly group these logs, greatly improving their usability in Kibana.