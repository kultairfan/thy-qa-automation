# Step Library

The AI "Gherkin writer" may ONLY use the steps below when it writes feature files.
If a scenario needs a step that is not in this list, the scenario must be tagged `@pending`
and a human writes the new step definition first.

Refresh this list after adding steps:

```bash
npx bddgen export
```

## Navigation / page

- `Given I open the Turkish Airlines home page`
- `Given I open the Turkish Airlines home page in {string}` (example: `"en-tr"`)
- `Then the page URL should contain {string}`
- `Then the page language should be {string}` (html lang attribute, example: `"en"`)

## Flight booker

- `When I select the {string} trip type` (`"one-way"` or `"round-trip"`)
- `When I type {string} into the {string} field` (field: `"origin"` or `"destination"`)
- `Then the airport suggestions should include {string}` (example: `"ESB"`)
- `Then the flight search form should be visible`
- `Then the {string} field label should be {string}` (example: `"origin"`, `"From"`)

## Language

- `When I change the site language to {string}` (`"English"` or `"Türkçe"`)
- `Then the language selector should show {string}` (example: `"EN-TR"`)

## Rules for generated features

- File name: `features/<JIRA-KEY>.feature`, first line tags: `@<JIRA-KEY> @smoke`
- Maximum 2 scenarios per story (live production site, keep the load low)
- No login, booking, payment or check-in scenarios
