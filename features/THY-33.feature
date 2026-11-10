@THY-33 @smoke
Feature: THY-33 BlazeDemo - Login with invalid credentials

  Scenario: Login fails with unknown email and wrong password
    Given I open the BlazeDemo login page
    When I fill the login email with "unknown@example.com"
    And I fill the login password with "wrongpass"
    And I click the "Login" button
    Then I should see an error message "Invalid credentials"
    And the page title should be "BlazeDemo"
