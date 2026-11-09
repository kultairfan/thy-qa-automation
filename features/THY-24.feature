@THY-24 @smoke
Feature: THY-24 BlazeDemo - Purchase a flight

  Scenario: Purchase the first flight from Boston to Rome
    Given I open the BlazeDemo home page
    When I search flights from "Boston" to "Rome"
    And I choose flight number 1 from the list
    Then the purchase summary should show "Total Cost"
    When I fill the "name" field with "Test Passenger"
    And I fill the "address" field with "1 Test Street"
    And I fill the "city" field with "Istanbul"
    And I fill the "zip code" field with "34000"
    And I fill the "name on card" field with "Test Passenger"
    And I purchase the flight
    Then I should see the heading "Thank you for your purchase today!"
    And the page title should be "BlazeDemo Confirmation"
    And the confirmation should show a booking "Id"
    And the confirmation should show "Status" as "PendingCapture"
