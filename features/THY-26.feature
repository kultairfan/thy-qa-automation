@THY-26 @smoke
Feature: THY-26 BlazeDemo - Flight results table

  Scenario: Verify flight results table for Paris to Rome
    Given I open the BlazeDemo home page
    When I search flights from "Paris" to "Rome"
    Then I should see the heading "Flights from Paris to Rome:"
    Then I should see at least 5 flights
    Then every flight should have a "Choose This Flight" button
    Then each row should display "flight number"
    Then each row should display "airline"
    Then each row should display "departure time"
    Then each row should display "arrival time"
    Then each row should display "price"
