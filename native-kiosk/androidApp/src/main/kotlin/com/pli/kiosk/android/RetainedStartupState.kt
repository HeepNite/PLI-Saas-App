package com.pli.kiosk.android

/** Closed, identifier-free startup evidence. Values are safe to expose only as coarse native diagnostics. */
enum class RetainedStartupState {
    EMPTY,
    RESOLVED,
    KNOWN_PAYMENT,
    TICKET_ONLY_UNKNOWN_CREATION,
    TICKETLESS_PRE_ISSUANCE,
    SESSION_MISMATCH,
    MALFORMED,
    CORRUPT,
    SERVER_REJECTED,
}

/** Closed, identifier-free production trace for one retained recovery attempt. */
enum class RetainedRecoveryStage {
    INELIGIBLE,
    SESSION_REJECTED,
    SCHEDULED,
    SESSION_RENEWED,
    SERVER_PAID,
    SERVER_PENDING,
    PAID_COMMITTED,
    RELOAD_REQUESTED,
    FAILED,
}

fun classifyRetainedStartupState(
    state: DurableState,
    approvedOrigin: String,
    currentBrowserAssociation: String?,
): RetainedStartupState {
    val attempt = state.attempt ?: return RetainedStartupState.EMPTY
    val session = state.session ?: return RetainedStartupState.MALFORMED
    if (session.origin != approvedOrigin ||
        attempt.origin != session.origin ||
        attempt.sessionAssociation != session.association ||
        currentBrowserAssociation == null ||
        currentBrowserAssociation != session.association
    ) return RetainedStartupState.SESSION_MISMATCH
    if (attempt.mode != AttemptMode.PREPARED) return RetainedStartupState.MALFORMED

    val ticket = attempt.ticket
    if (ticket == null) {
        return if (!attempt.resolved && attempt.paymentIntentId == null) {
            RetainedStartupState.TICKETLESS_PRE_ISSUANCE
        } else RetainedStartupState.MALFORMED
    }
    if (ticket.value.isBlank() || ticket.readerId.isBlank() || ticket.expiresAt <= 0L ||
        ticket.locationId != Approved.LOCATION
    ) return RetainedStartupState.MALFORMED

    val paymentIntentId = attempt.paymentIntentId
    if (attempt.resolved) {
        return if (!paymentIntentId.isNullOrBlank()) RetainedStartupState.RESOLVED else RetainedStartupState.MALFORMED
    }
    return if (paymentIntentId.isNullOrBlank()) {
        RetainedStartupState.TICKET_ONLY_UNKNOWN_CREATION
    } else RetainedStartupState.KNOWN_PAYMENT
}
