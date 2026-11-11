@THY-32 @smoke
Feature: THY-32 BlazeDemo - Destination of the week

  Scenario: Visitor opens destination of the week
    Given I open the BlazeDemo home page
    When I click the destination of the week link
    Then the page title should be "BlazeDemo - vacation"
    And I should see the text "Destination of the week: Hawaii !"
    And I should see an image of the destination
