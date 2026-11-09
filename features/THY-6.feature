@THY-6 @smoke
Feature: THY-6 Language and currency selection
  Acceptance criteria #1 and #5: changing the language updates the content and the URL.

  Scenario: Switching the site language from Turkish to English
    Given I open the Turkish Airlines home page
    When I change the site language to "English"
    Then the page URL should contain "/en-"
    And the page language should be "en"
    And the language selector should show "EN-TR"
    And the "origin" field label should be "From"
