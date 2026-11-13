@THY-56 @smoke
Feature: THY-56 BlazeDemo - Back to home from the results page

Scenario: Return to home page via Travel The World link
Given I open the BlazeDemo home page
When I search flights from "Paris" to "London"
Then I should see the heading "Flights from Paris to London:"
And I should see at least 1 flight
And every flight should have a "Choose This Flight" button
Then I should see the text "Travel The World"
When I click the "Travel The World" link
Then the page title should be "BlazeDemo"
