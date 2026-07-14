---
title: "Les tests unitaires en Python : exploiter pytest à fond"
date: 2026-07-14T09:20:00+02:00
tags: [python]
featured: false
draft: true
summary: "Écrire des tests, tout le monde sait faire. Écrire des tests courts, lisibles et qui couvrent dix cas en cinq lignes, c'est le métier de pytest : paramétrisation, fixtures, monkeypatch, tmp_path — le tour des outils qui changent vraiment la donne."
---

Le premier test unitaire Python qu'on écrit ressemble toujours à ça : une
fonction, un `assert`, et ça passe. Puis les cas s'accumulent, on
copie-colle le test en changeant deux valeurs, on ajoute un `try/except`
pour tester une erreur… et six mois plus tard, la suite de tests est le
fichier le plus pénible du projet.

pytest est conçu pour éviter exactement cette dérive. Cet article fait le
tour de ses outils, du plus simple au plus puissant, avec le même fil
rouge : une petite fonction de validation de mots de passe.

## Le sujet du jour

```python {filename="password.py"}
class PasswordError(ValueError):
    pass

def check_password(password: str) -> None:
    """Lève PasswordError si le mot de passe est trop faible."""
    if len(password) < 8:
        raise PasswordError("trop court")
    if password.lower() == password:
        raise PasswordError("il faut au moins une majuscule")
    if not any(c.isdigit() for c in password):
        raise PasswordError("il faut au moins un chiffre")
```

## La base : assert, et rien d'autre

Avec pytest, pas de `self.assertEqual` ni de classe à hériter — un
`assert` natif suffit, et le rapport d'échec affiche les valeurs des deux
côtés :

```python {filename="test_password.py"}
from password import check_password

def test_un_bon_mot_de_passe_passe():
    check_password("Correct1Horse")   # ne doit pas lever
```

Structurez chaque test en trois temps — *Arrange, Act, Assert* — et
donnez-lui un nom qui se lit comme une phrase : quand il échouera dans six
mois, son nom sera la première (et parfois la seule) chose que vous lirez
dans le rapport de CI.

## Tester les erreurs : pytest.raises

Pour vérifier qu'une exception est levée, `pytest.raises` remplace le
couple `try/except` + `assert False` :

```python
import pytest
from password import PasswordError, check_password

def test_mot_de_passe_trop_court():
    with pytest.raises(PasswordError, match="trop court"):
        check_password("Ab1")
```

L'argument `match` (une regex) vérifie aussi le message — utile quand la
même exception couvre plusieurs règles, comme ici.

## L'arme principale : la paramétrisation

C'est LE réflexe à prendre. Au lieu de dupliquer un test par cas, on donne
un **jeu de données** en entrée de la fonction de test :

```python
@pytest.mark.parametrize(
    ("password", "raison"),
    [
        ("Ab1", "trop court"),
        ("abcdefg1", "il faut au moins une majuscule"),
        ("Abcdefgh", "il faut au moins un chiffre"),
    ],
    ids=["trop-court", "sans-majuscule", "sans-chiffre"],
)
def test_mots_de_passe_refuses(password, raison):
    with pytest.raises(PasswordError, match=raison):
        check_password(password)
```

Trois cas, un seul corps de test. À l'exécution, pytest les traite comme
**trois tests indépendants** — si un seul échoue, les deux autres
tournent quand même, et l'option `ids` rend le rapport limpide :

```text
test_password.py::test_mots_de_passe_refuses[trop-court] PASSED
test_password.py::test_mots_de_passe_refuses[sans-majuscule] PASSED
test_password.py::test_mots_de_passe_refuses[sans-chiffre] FAILED
```

Deux raffinements à connaître :

- **Empiler les décorateurs** produit le produit cartésien — pratique pour
  tester toutes les combinaisons de deux axes :

  ```python
  @pytest.mark.parametrize("locale", ["fr", "en", "de"])
  @pytest.mark.parametrize("devise", ["EUR", "USD"])
  def test_formatage_prix(locale, devise):
      ...   # 6 tests générés
  ```

- **`pytest.param`** permet de marquer un cas particulier, par exemple un
  bug connu pas encore corrigé :

  ```python
  pytest.param("Pässw0rd", id="unicode",
               marks=pytest.mark.xfail(reason="bug #142")),
  ```

## Les fixtures : préparer sans dupliquer

Une fixture est une fonction qui fabrique ce dont un test a besoin ; le
test la reçoit **par son nom d'argument** :

```python
@pytest.fixture
def utilisateur():
    return User(email="alice@example.com", password_hash=hash_pw("Correct1Horse"))

def test_authentification(utilisateur):
    assert authenticate(utilisateur.email, "Correct1Horse")
```

Trois propriétés en font bien plus qu'un `setUp()` :

- **Le nettoyage par `yield`** — tout ce qui suit le `yield` s'exécute
  après le test, même s'il a échoué :

  ```python
  @pytest.fixture
  def connexion_db():
      conn = sqlite3.connect(":memory:")
      creer_schema(conn)
      yield conn
      conn.close()
  ```

- **La portée** — `scope="session"` fabrique la ressource une fois pour
  toute la suite (un conteneur Docker, un modèle chargé en mémoire) au
  lieu d'une fois par test.
- **La composition** — une fixture peut en demander une autre :
  `utilisateur` peut dépendre de `connexion_db`, pytest résout le graphe.

Placez les fixtures partagées dans un `conftest.py` : tous les tests du
répertoire (et des sous-répertoires) les voient sans le moindre import.

## Les fixtures fournies : tmp_path et monkeypatch

pytest embarque des fixtures prêtes à l'emploi ; deux d'entre elles
éliminent les pires causes de tests fragiles.

**`tmp_path`** fournit un répertoire temporaire unique, nettoyé
automatiquement — fini les tests qui écrivent dans le répertoire courant :

```python
def test_export_csv(tmp_path):
    fichier = tmp_path / "export.csv"
    exporter_utilisateurs(fichier)
    assert fichier.read_text().startswith("email;date_inscription")
```

**`monkeypatch`** remplace temporairement un attribut, une variable
d'environnement ou une fonction, et **remet tout en place à la fin du
test** :

```python
def test_url_api_depuis_env(monkeypatch):
    monkeypatch.setenv("API_URL", "https://test.local")
    assert build_client().base_url == "https://test.local"

def test_generation_sans_hasard(monkeypatch):
    monkeypatch.setattr("secrets.token_hex", lambda n: "a" * (n * 2))
    assert generer_jeton() == "aaaaaaaaaaaaaaaa"
```

C'est souvent plus lisible qu'un `unittest.mock.patch` en décorateur — et
pour les vrais doublures avec vérification d'appels, `mocker` (du plugin
`pytest-mock`) offre la même API que `unittest.mock` avec le nettoyage
automatique en plus.

## Les à-côtés qui font la différence

**Les flottants** ne se comparent jamais avec `==` :

```python
assert prix_ttc(10.0) == pytest.approx(12.0, rel=1e-6)
```

**Les marqueurs** organisent la suite — déclarez-les dans la config pour
éviter les fautes de frappe silencieuses :

```toml {filename="pyproject.toml"}
[tool.pytest.ini_options]
markers = ["slow: tests > 1s, exclus du run rapide"]
addopts = "--strict-markers"
```

```bash
pytest -m "not slow"     # la boucle rapide, en local
pytest                    # tout, en CI
```

**La couverture** avec `pytest-cov`, en visant la lisibilité du rapport
plutôt qu'un chiffre totem :

```bash
pytest --cov=password --cov-report=term-missing
```

```text
Name          Stmts   Miss  Cover   Missing
-------------------------------------------
password.py       9      1    89%   14
```

La colonne `Missing` pointe la ligne 14 jamais exécutée : c'est un test
paramétré à compléter, pas un pourcentage à négocier.

## Le réflexe final : tester le comportement, pas l'implémentation

Tous ces outils servent un même but : des tests qui décrivent **ce que
fait** le code, pas **comment** il le fait. Un bon signal d'alarme : si
renommer une méthode privée casse dix tests, ils testaient
l'implémentation. Si un vrai bug ne casse aucun test, ils ne testaient
rien du tout.

> pytest récompense la paresse bien placée : `parametrize` pour dérouler
> des jeux de données au lieu de copier-coller des tests, les fixtures
> pour préparer et nettoyer sans y penser, `tmp_path` et `monkeypatch`
> pour isoler du système. Une suite de tests courte à écrire est une
> suite qu'on continue d'écrire.
