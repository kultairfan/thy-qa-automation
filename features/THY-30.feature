@THY-30 @smoke
Feature: THY-30 BlazeDemo - Confirmation details

  Scenario: Verify confirmation details
    Given I open the BlazeDemo home page
    When I search flights from "Paris" to "London"
    Then I should see the heading "Flights from Paris to London:"
    And I should see at least 1 flight
    And every flight should have a "Choose This Flight" button
    When I choose flight number 1 from the list
    Then the purchase summary should show "Total Cost"
    When I fill the "name" field with "Test Passenger"
    And I fill the "address" field with "123 Test St"
    And I fill the "city" field with "Test City"
    And I fill the "state" field with "Test State"
    And I fill the "zip code" field with "12345"
    And I fill the "name on card" field with "Test Card"
    And I purchase the flight
    Then the confirmation should show a booking "Id"
    And the confirmation should show "Amount" as "USD"
    And the confirmation should show "Card Number" as "xxxx"
    And the confirmation should show "Auth Code" as "888888"
    And the confirmation should show "Date" as "20"
