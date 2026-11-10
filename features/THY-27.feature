@THY-27 @smoke
Feature: THY-27 BlazeDemo - Choose a specific flight

Scenario: Choose the third flight and verify purchase page
  Given I open the BlazeDemo home page
  When I search flights from "Paris" to "London"
  Then I should see the heading "Flights from Paris to London:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  When I choose flight number 3 from the list
  Then the page title should be "BlazeDemo Purchase"
  And the purchase summary should show "Total Cost"
