@THY-25 @smoke
Feature: THY-25 BlazeDemo - Search from every departure city

Scenario: Search from Paris, Philadelphia, Boston and Portland
    Given I open the BlazeDemo home page
    When I search flights from "Paris" to "London"
    Then I should see the heading "Flights from Paris to London:"
    And I should see at least 1 flight
    Given I open the BlazeDemo home page
    When I search flights from "Philadelphia" to "Rome"
    Then I should see the heading "Flights from Philadelphia to Rome:"
    And I should see at least 1 flight
    Given I open the BlazeDemo home page
    When I search flights from "Boston" to "Berlin"
    Then I should see the heading "Flights from Boston to Berlin:"
    And I should see at least 1 flight
    Given I open the BlazeDemo home page
    When I search flights from "Portland" to "New York"
    Then I should see the heading "Flights from Portland to New York:"
    And I should see at least 1 flight

Scenario: Search from San Diego, Mexico City and São Paolo
    Given I open the BlazeDemo home page
    When I search flights from "San Diego" to "Dublin"
    Then I should see the heading "Flights from San Diego to Dublin:"
    And I should see at least 1 flight
    Given I open the BlazeDemo home page
    When I search flights from "Mexico City" to "Cairo"
    Then I should see the heading "Flights from Mexico City to Cairo:"
    And I should see at least 1 flight
    Given I open the BlazeDemo home page
    When I search flights from "São Paolo" to "Buenos Aires"
    Then I should see the heading "Flights from São Paolo to Buenos Aires:"
    And I should see at least 1 flight
