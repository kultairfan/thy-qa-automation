@THY-23 @smoke
Feature: THY-23 BlazeDemo - Flight search

Scenario: Search for flights between two cities
Given I open the BlazeDemo home page
When I search flights from "Paris" to "London"
Then I should see the heading "Flights from Paris to London:"
And I should see at least 1 flight
And every flight should have a "Choose This Flight" button
