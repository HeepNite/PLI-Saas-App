package com.pli.kiosk.android

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.Test

class StripeDiscoveryGenerationTest {
    @Test
    fun `cancelled stale discovery failure cannot poison the selected reader path`() {
        val claim = claimDiscoveryFailure(callbackGeneration = 4L, currentGeneration = 5L)

        assertFalse(claim.report)
        assertEquals(5L, claim.nextGeneration)
    }

    @Test
    fun `current discovery failure remains terminal and advances the generation`() {
        val claim = claimDiscoveryFailure(callbackGeneration = 5L, currentGeneration = 5L)

        assertTrue(claim.report)
        assertEquals(6L, claim.nextGeneration)
    }
}
