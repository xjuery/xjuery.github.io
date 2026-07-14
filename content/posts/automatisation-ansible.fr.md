---
title: "Créer une automatisation simple avec Ansible : le guide du débutant"
date: 2026-07-14T09:50:00+02:00
tags: [ansible, automation]
featured: false
draft: true
summary: "De zéro à un playbook qui installe et configure Nginx sur plusieurs serveurs : inventaire, commandes ad-hoc, tâches, handlers et templates — les fondations d'Ansible expliquées pas à pas, sans rien installer sur les machines cibles."
---

Vous venez de configurer un serveur à la main : quelques `apt install`,
deux fichiers de conf, un `systemctl enable`. Ça marche. Maintenant il
faut faire pareil sur le deuxième serveur. Puis sur le troisième. Puis se
souvenir, dans six mois, de ce qui avait été fait exactement.

C'est précisément le problème qu'Ansible résout : décrire la configuration
**une fois**, dans des fichiers texte versionnés, et laisser l'outil
l'appliquer partout, autant de fois que nécessaire. Ce guide part de zéro
et se termine sur une automatisation complète : installer et configurer
Nginx sur un parc de serveurs.

## Comment ça marche : SSH, et c'est tout

Ansible a un atout majeur sur ses concurrents : **aucun agent à installer
sur les machines cibles**. Il se connecte en SSH depuis votre poste (le
« nœud de contrôle »), pousse de petits modules Python, les exécute, et
repart. Si vous savez faire `ssh serveur`, Ansible sait travailler.

![Architecture d'Ansible : un nœud de contrôle avec le playbook et l'inventaire pilote plusieurs serveurs par SSH, sans agent](/images/posts/automatisation-ansible/architecture.svg)

Installation côté poste de travail uniquement :

```bash
pipx install ansible        # ou : brew install ansible
ansible --version
```

Seul prérequis côté serveurs : un accès SSH par clé et Python (présent
par défaut sur toutes les distributions récentes).

## Étape 1 — l'inventaire : dire à Ansible où sont les machines

L'inventaire liste les machines et les range en groupes :

```ini {filename="inventory.ini"}
[web]
web1 ansible_host=192.168.1.11
web2 ansible_host=192.168.1.12

[db]
db1 ansible_host=192.168.1.21

[all:vars]
ansible_user=admin
```

Premier contact — le module `ping` vérifie que tout le monde répond :

```bash
ansible all -i inventory.ini -m ping
```

```text
web1 | SUCCESS => { "ping": "pong" }
web2 | SUCCESS => { "ping": "pong" }
db1  | SUCCESS => { "ping": "pong" }
```

Si ça répond `pong` partout, le plus dur est fait.

## Étape 2 — les commandes ad-hoc : le premier réflexe

Avant même les playbooks, Ansible sert de télécommande multi-machines :

```bash
ansible web -i inventory.ini -m command -a "uptime"
ansible all -i inventory.ini -m apt -a "update_cache=true" --become
```

`-m` choisit le **module** (la brique d'action), `-a` ses arguments,
`--become` demande l'élévation sudo. Pratique pour un diagnostic ; mais
dès qu'on veut du reproductible, on passe au playbook.

## Étape 3 — le premier playbook

Un playbook est un fichier YAML qui décrit un **état désiré** : « sur les
machines du groupe `web`, Nginx doit être installé, configuré et
démarré ». Ansible se charge d'y amener chaque machine.

```yaml {filename="playbook.yml"}
---
- name: Configurer les serveurs web
  hosts: web
  become: true          # sudo pour toutes les tâches

  tasks:
    - name: Installer Nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true

    - name: Démarrer et activer Nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

On lance :

```bash
ansible-playbook -i inventory.ini playbook.yml
```

```text
TASK [Installer Nginx] *********************************************
changed: [web1]
changed: [web2]

TASK [Démarrer et activer Nginx] ***********************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************
web1 : ok=3  changed=1  unreachable=0  failed=0
web2 : ok=3  changed=1  unreachable=0  failed=0
```

Relancez la même commande : tout passe en `ok`, `changed=0`. C'est
**l'idempotence**, l'idée centrale d'Ansible : une tâche ne décrit pas une
action (« installe Nginx ») mais un état (« Nginx est présent »). Si
l'état est déjà là, Ansible ne touche à rien. On peut donc rejouer un
playbook sans risque — et c'est même comme ça qu'on vérifie qu'un parc n'a
pas dérivé.

## Étape 4 — variables et templates : la configuration sur mesure

La vraie puissance arrive avec les **templates Jinja2** : des fichiers de
configuration à trous, remplis par des variables propres à chaque machine
ou groupe.

```yaml {filename="playbook.yml (extrait)"}
  vars:
    server_name: demo.example.com
    web_root: /var/www/demo

  tasks:
    - name: Créer la racine web
      ansible.builtin.file:
        path: "{{ web_root }}"
        state: directory
        owner: www-data
        mode: "0755"

    - name: Déployer la page d'accueil
      ansible.builtin.copy:
        dest: "{{ web_root }}/index.html"
        content: "<h1>Servi par {{ inventory_hostname }}</h1>\n"

    - name: Déployer la configuration Nginx
      ansible.builtin.template:
        src: templates/site.conf.j2
        dest: /etc/nginx/sites-available/demo.conf
      notify: Recharger Nginx
```

Le template mélange texte fixe et variables :

```nginx {filename="templates/site.conf.j2"}
server {
    listen 80;
    server_name {{ server_name }};
    root {{ web_root }};

    location / {
        try_files $uri $uri/ =404;
    }
}
```

`{{ inventory_hostname }}` est une variable magique fournie par Ansible —
chaque serveur affichera son propre nom, avec un seul fichier source.

## Étape 5 — les handlers : ne redémarrer que si nécessaire

Le `notify` ci-dessus pointe vers un **handler** : une tâche spéciale qui
ne s'exécute **que si quelque chose a changé**, une seule fois, à la fin
du play :

```yaml {filename="playbook.yml (extrait)"}
  handlers:
    - name: Recharger Nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Dix tâches peuvent notifier le même handler : Nginx ne sera rechargé
qu'une fois. Et si le playbook tourne sans rien modifier, il ne sera pas
rechargé du tout. C'est le complément naturel de l'idempotence — pas de
redémarrage de service pour rien.

## Le playbook complet

```yaml {filename="playbook.yml"}
---
- name: Configurer les serveurs web
  hosts: web
  become: true

  vars:
    server_name: demo.example.com
    web_root: /var/www/demo

  tasks:
    - name: Installer Nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true

    - name: Créer la racine web
      ansible.builtin.file:
        path: "{{ web_root }}"
        state: directory
        owner: www-data
        mode: "0755"

    - name: Déployer la page d'accueil
      ansible.builtin.copy:
        dest: "{{ web_root }}/index.html"
        content: "<h1>Servi par {{ inventory_hostname }}</h1>\n"

    - name: Déployer la configuration Nginx
      ansible.builtin.template:
        src: templates/site.conf.j2
        dest: /etc/nginx/sites-available/demo.conf
      notify: Recharger Nginx

    - name: Activer le site
      ansible.builtin.file:
        src: /etc/nginx/sites-available/demo.conf
        dest: /etc/nginx/sites-enabled/demo.conf
        state: link
      notify: Recharger Nginx

    - name: Démarrer et activer Nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Recharger Nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Deux options précieuses pour travailler sereinement :

```bash
ansible-playbook -i inventory.ini playbook.yml --check --diff
```

`--check` simule sans rien modifier, `--diff` montre ce qui *serait*
changé dans les fichiers. Le duo parfait avant de lancer sur un parc réel.

## Et après ?

Trois pistes quand ce playbook vous semblera étroit :

- **Les rôles** : dès qu'un playbook dépasse ~100 lignes, découpez-le en
  rôles (`ansible-galaxy init nginx`) — même contenu, rangé dans une
  arborescence standard réutilisable de projet en projet.
- **`group_vars/`** : sortez les variables du playbook dans
  `group_vars/web.yml` — chaque groupe de l'inventaire a ses valeurs.
- **Ansible Vault** : chiffrez les secrets (`ansible-vault encrypt
  secrets.yml`) au lieu de les committer en clair.

> Ansible, c'est trois fichiers texte : un inventaire qui dit *où*, un
> playbook qui dit *quoi*, des templates qui disent *comment configurer*.
> Le tout versionné dans Git, rejouable à l'infini grâce à l'idempotence,
> et sans agent à maintenir. Si vous savez faire SSH, vous savez
> automatiser.
