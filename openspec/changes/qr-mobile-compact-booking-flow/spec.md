# Spec: QR Mobile Compact Booking Flow

## Requirement: QR mobile booking uses a compact flow

When a customer scans a class QR from a mobile device and chooses to continue booking, the purchase flow MUST use the scanned class context instead of the full regular course booking flow.

### Scenario: Signed-in customer books scanned class

Given a signed-in customer scans a QR for a class they have not booked
And the customer has no usable package for that class
When they choose to continue booking
Then the booking flow opens for the scanned course
And the scanned date and time are used as the booking context
And the flow does not show party selection
And the flow does not show editable date/time selection
And the flow does not show the final review step
And the flow proceeds to payment after any required promotion/photo step

### Scenario: Signed-out customer books scanned class

Given a signed-out customer scans a QR for a class
And the customer has no active account session on the device
When they choose to continue booking
Then the booking flow opens for the scanned course
And the scanned date and time are used as the booking context
And the flow collects only the minimum required contact/account information
And the flow does not show party selection
And the flow does not show editable date/time selection
And the flow does not show the final review step
And the flow proceeds to payment after required contact/photo/promotion steps

## Requirement: QR mobile compact flow preserves account and sign-in behavior

The compact flow MUST preserve existing account detection and sign-in recovery behavior.

### Scenario: Existing account is detected during compact booking

Given a signed-out customer continues QR mobile booking
And the entered contact information matches an existing account
When the flow requires sign-in
Then the compact sign-in UI is shown
And after successful sign-in the user resumes the QR mobile compact flow
And the user is not redirected to the regular booking flow

### Scenario: Active session skips contact collection

Given a signed-in customer continues QR mobile booking
When the account data is trusted
Then the compact flow skips the contact information step
And continues to promotion or payment as applicable

## Requirement: Consecutive promotion is supported in QR mobile compact booking

If a consecutive class promotion is available for the scanned class/date/time, the compact flow MUST offer it before payment.

### Scenario: Consecutive promotion is available

Given a customer continues QR mobile booking for a scanned class
And a consecutive promotion exists for the scanned class/date/time
When the compact booking flow reaches the promotion point
Then the promotion is shown before payment
And accepting the promotion includes it in the checkout payload
And declining the promotion continues to payment for the scanned class only

### Scenario: Consecutive promotion is not available

Given a customer continues QR mobile booking for a scanned class
And no consecutive promotion exists for the scanned class/date/time
When required account/photo steps are complete
Then the flow proceeds directly to payment

## Requirement: Package holders keep direct check-in behavior

QR mobile compact booking MUST NOT replace existing direct check-in behavior for eligible package holders.

### Scenario: Customer has usable package credit

Given a customer scans a QR from a phone
And the customer has a usable active package for the scanned class
When the QR check-in API resolves the scan
Then the customer is checked in directly
And one credit is consumed when the package is limited
And no purchase flow is opened

## Requirement: QR mobile compact mode must not inherit kiosk terminal behavior

The mobile compact flow MUST reuse shared enrollment logic without enabling kiosk-only station behavior.

### Scenario: QR mobile compact booking is not a kiosk terminal session

Given a customer continues QR mobile booking from their own phone
When the compact booking flow opens
Then kiosk terminal PIN/session behavior is not enabled
And station timeout behavior is not enabled
And kiosk-only numeric keypad behavior is not required
And the flow remains optimized for personal mobile use

## Requirement: Regular course booking remains unchanged

The regular course booking flow MUST remain available for normal course-page bookings outside QR mobile compact context.

### Scenario: User opens booking from a course page normally

Given a user opens a course page without `qrBooking=1`
When they start booking normally
Then the regular booking flow behavior remains unchanged
