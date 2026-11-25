@THY-48 @smoke
Feature: THY-48 BlazeDemo - Search to every destination city

Scenario: Search Boston to first set of destinations
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "Buenos Aires"
  Then I should see the heading "Flights from Boston to Buenos Aires:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "Rome"
  Then I should see the heading "Flights from Boston to Rome:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "London"
  Then I should see the heading "Flights from Boston to London:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "Berlin"
  Then I should see the heading "Flights from Boston to Berlin:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button

Scenario: Search Boston to remaining destinations
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "New York"
  Then I should see the heading "Flights from Boston to New York:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "Dublin"
  Then I should see the heading "Flights from Boston to Dublin:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
  Given I open the BlazeDemo home page
  When I search flights from "Boston" to "Cairo"
  Then I should see the heading "Flights from Boston to Cairo:"
  And I should see at least 1 flight
  And every flight should have a "Choose This Flight" button
