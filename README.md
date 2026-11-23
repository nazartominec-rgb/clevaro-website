# CLEVARO – strona internetowa

Statyczna strona firmy CLEVARO (sprzątanie obiektów komercyjnych, Warszawa), hostowana na Netlify.

## Struktura

```
public/                  pliki strony (publikowane przez Netlify)
  index.html             strona główna
  style.css              style
  script.js              menu, szybki kontakt, ustawienia cookies, formularz
  fonts/                 czcionka Inter (SIL OFL 1.1, LICENSE-Inter.txt)
netlify/functions/       funkcje serwerowe (submit-quote – kolejny etap)
netlify.toml             konfiguracja Netlify i nagłówki bezpieczeństwa
```

## Wdrożenie na Netlify

1. Netlify → *Add new site* → *Import an existing project* → GitHub → `clevaro-website`.
2. Ustawienia budowania są odczytywane z `netlify.toml` (brak polecenia build, katalog `public`).
3. Klucze usług (np. do wysyłki e-maili z formularza) dodaje się w *Site configuration → Environment variables*, nigdy w kodzie.

## Do uzupełnienia przed publikacją

- `netlify/functions/submit-quote` – obsługa formularza (formularz wysyła dane na `/.netlify/functions/submit-quote`).
- `public/polityka-prywatnosci.html`, `public/cookies.html` – podlinkowane w formularzu i stopce.
- Dane administratora danych: `[UZUPEŁNIĆ: …]` w formularzu i `[DANE ADMINISTRATORA …]` w stopce.
- Domena: `canonical`, `og:url`, `og:image` (komentarz `TWOJA-DOMENA.pl` w `index.html`).
- `[PODGLĄD]` w `<title>`.

## Podgląd lokalny

```
npx netlify dev        # z funkcjami
# lub
python3 -m http.server -d public 8080
```
