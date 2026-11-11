@THY-29 @smoke
Feature: THY-29 BlazeDemo - Purchase with empty passenger form

Scenario: Submit purchase form empty and verify confirmation
  Given I open the BlazeDemo home page
  When I search flights from "Paris" to "London"
  Then I should see the heading "Flights from Paris to London:"
  Then I should see at least 1 flight
  Then every flight should have a "Choose This Flight" button
  When I choose flight number 1 from the list
  Then the purchase summary should show "Total Cost"
  When I purchase the flight
  Then the confirmation should show a booking "Id"
  Then the confirmation should show "Status" as "PendingCapture"
