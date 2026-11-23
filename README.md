# CLEVARO – strona internetowa

Statyczna strona firmy CLEVARO (sprzątanie obiektów komercyjnych, Warszawa), hostowana na Netlify.

## Struktura

```
public/                       pliki strony (publikowane przez Netlify)
  index.html                  strona główna
  polityka-prywatnosci.html   polityka prywatności (projekt – do uzupełnienia)
  cookies.html                polityka cookies (projekt – do uzupełnienia)
  404.html                    strona błędu 404
  style.css                   style
  script.js                   menu, szybki kontakt, ustawienia cookies, formularz
  fonts/                      czcionka Inter (SIL OFL 1.1, LICENSE-Inter.txt)
netlify/functions/
  submit-quote.mjs            obsługa formularza, wysyłka e-maila przez Resend
netlify.toml                  konfiguracja Netlify i nagłówki bezpieczeństwa
```

## Wdrożenie na Netlify

1. Netlify → *Add new site* → *Import an existing project* → GitHub → `clevaro-website`.
2. Ustawienia budowania są odczytywane z `netlify.toml` (brak polecenia build, katalog `public`).
3. Załóż konto w [Resend](https://resend.com) i utwórz klucz API.
4. W Netlify → *Site configuration* → *Environment variables* dodaj:

| Zmienna | Wymagana | Opis |
|---|---|---|
| `RESEND_API_KEY` | tak | klucz API z Resend (sekret – tylko w Netlify, nigdy w kodzie) |
| `QUOTE_TO_EMAIL` | tak | adres, na który trafiają zgłoszenia z formularza |
| `QUOTE_FROM_EMAIL` | nie | nadawca, np. `CLEVARO <formularz@twoja-domena.pl>`; wymaga domeny zweryfikowanej w Resend. Bez niej używany jest `onboarding@resend.dev`, który wysyła tylko na e-mail właściciela konta Resend |
| `ALLOWED_ORIGINS` | nie | adresy strony oddzielone przecinkami, np. `https://clevaro.netlify.app` – odrzuca zgłoszenia z innych stron |

5. Po zmianie zmiennych wykonaj ponowne wdrożenie (*Deploys → Trigger deploy*).

## Formularz – zabezpieczenia

- walidacja po stronie przeglądarki i serwera (te same reguły),
- ukryte pole `website` i minimalny czas wypełnienia (3 s) przeciw botom,
- limit 5 zgłoszeń z jednego IP w ciągu 10 minut (w obrębie instancji funkcji),
- opcjonalne sprawdzanie nagłówka `Origin`.

## Do uzupełnienia przed publikacją

- Dane administratora danych: `[UZUPEŁNIĆ: …]` w formularzu (`index.html`), w stopce (`[DANE ADMINISTRATORA …]`) i w obu politykach.
- Pozostałe pola `[UZUPEŁNIĆ]` w `polityka-prywatnosci.html` i `cookies.html` (data, adres, NIP/REGON, okres przechowywania, podstawy przekazania danych) – najlepiej z weryfikacją prawną.
- Domena: `canonical`, `og:url`, `og:image` (komentarz `TWOJA-DOMENA.pl` w `index.html`).
- `[PODGLĄD]` w `<title>` strony głównej.
- Zdjęcie w sekcji „O firmie” (`[MIEJSCE NA ZDJĘCIE ZESPOŁU / REALIZACJI]`).

## Podgląd lokalny

```
npx netlify dev                       # strona + funkcja formularza
python3 -m http.server -d public 8080 # tylko strona
```
