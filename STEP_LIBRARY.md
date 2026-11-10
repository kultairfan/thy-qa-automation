# Step Library

The AI "Gherkin writer" may ONLY use the steps below when it writes feature files.
If a scenario needs a step that is not in this list, the scenario must be tagged `@pending`
and a human writes the new step definition first. Refresh the list with `npx bddgen export`.

Test site: https://blazedemo.com

## Search (home page + results)

- `Given I open the BlazeDemo home page`
- `When I search flights from {string} to {string}`
  - departure: Paris, Philadelphia, Boston, Portland, San Diego, Mexico City, São Paolo
  - destination: Buenos Aires, Rome, London, Berlin, New York, Dublin, Cairo
- `Then I should see the heading {string}` (example: `"Flights from Paris to London:"`)
- `Then I should see at least {int} flight(s)`
- `Then every flight should have a {string} button` (`"Choose This Flight"`)
- `Then the page title should be {string}`

## Purchase + confirmation

- `When I choose flight number {int} from the list` (1 = first row)
- `Then the purchase summary should show {string}` (example: `"Total Cost"`)
- `When I fill the {string} field with {string}` (any form field. Purchase form: name, address, city, state, zip code, name on card. Other forms such as login / register: the field label or name, e.g. "email", "password", "Confirm Password")
- `When I purchase the flight`
- `Then the confirmation should show a booking {string}` (`"Id"`)
- `Then the confirmation should show {string} as {string}` (example: `"Status"`, `"PendingCapture"`)

## Rules for generated features

- File name: `features/<JIRA-KEY>.feature`, first line tags: `@<JIRA-KEY> @smoke`
- Maximum 2 scenarios per story
- Never type real personal or card data; use obvious test values (e.g. "Test Passenger")

## Added by Step Builder (THY-33)

- `Given I open the BlazeDemo login page`
- `When I fill the login email with {string}`
- `When I fill the login password with {string}`
- `When I click the {string} button`
- `Then I should see an error message {string}`
