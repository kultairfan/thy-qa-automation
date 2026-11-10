@THY-34 @smoke
Feature: THY-34 BlazeDemo - Register form fields

Scenario: Register form fields are present
Given I open the BlazeDemo register page
When I fill the register field "Name" with "Test User"
And I fill the register field "Company" with "TestCo"
And I fill the register field "E-Mail Address" with "test@example.com"
And I fill the register field "Password" with "Password123"
And I fill the register field "Confirm Password" with "Password123"
Then the page title should be "BlazeDemo"

Scenario: Register with mismatched passwords shows error
Given I open the BlazeDemo register page
When I fill the register field "Name" with "Test User"
And I fill the register field "Company" with "TestCo"
And I fill the register field "E-Mail Address" with "test@example.com"
And I fill the register field "Password" with "Password123"
And I fill the register field "Confirm Password" with "Password321"
When I click the "Register" button
Then I should see an error message "Passwords do not match"
