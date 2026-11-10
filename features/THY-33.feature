@THY-33 @smoke
Feature: THY-33 BlazeDemo - Login with invalid credentials

Scenario: Login with invalid credentials
Given I open the BlazeDemo login page
When I fill the login email with "invalid@example.com"
And I fill the login password with "wrongpassword"
And I click the "Login" button
Then I should see an error message "Invalid email or password."
And the page title should be "BlazeDemo Login"
