@THY-47 @smoke
Feature: THY-47 BlazeDemo - Destination city list

Scenario: Verify destination city list and default selection
  Given I open the BlazeDemo home page
  Then the destination list should contain "Buenos Aires, Rome, London, Berlin, New York, Dublin, Cairo"
  And the default selected destination should be "Rome"
