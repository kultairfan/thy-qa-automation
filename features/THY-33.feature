@THY-33 @smoke
Feature: THY-33 BlazeDemo - Login with invalid credentials

Scenario: Login with unknown email and wrong password
  Given I open the BlazeDemo login page
  When I fill the email with "unknown@example.com"
  And I fill the password with "wrongpassword"
  And I click the "Login" button
  Then I should see the error message "419 Page Expired"
