@THY-1 @smoke
Feature: THY-1 Flight search - one-way
  Destination autocomplete on the home page flight booker.
  Acceptance criterion #1: airports are suggested after typing at least 3 characters.

  Scenario: Destination field suggests Ankara Esenboga airport
    Given I open the Turkish Airlines home page
    When I select the "one-way" trip type
    And I type "Ankara" into the "destination" field
    Then the airport suggestions should include "ESB"
