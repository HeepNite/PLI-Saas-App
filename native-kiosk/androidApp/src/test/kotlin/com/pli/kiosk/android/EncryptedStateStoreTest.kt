package com.pli.kiosk.android

import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.io.IOException
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = android.app.Application::class)
class EncryptedStateStoreTest {
    private lateinit var directory: File

    @Before
    fun createDirectory() {
        directory = Files.createTempDirectory("encrypted-state-store-test").toFile()
    }

    @After
    fun deleteDirectory() {
        directory.deleteRecursively()
    }

    @Test
    fun writeSyncsParentDirectoryAfterAtomicReplacementBeforeReportingSuccess() {
        val files = RecordingAtomicStateFileWriter()
        val store = EncryptedStateStore(directory, TestStateCryptography, files)
        val state = DurableState(session = StaffSession("https://approved.invalid", "association", "cookie", 2_000L))

        store.write(state)

        assertEquals(listOf("write", "replace", "sync-directory"), files.operations)
        assertEquals(state, store.read())
    }

    @Test
    fun directorySyncFailureFailsTheWriteAfterReplacement() {
        val files = RecordingAtomicStateFileWriter(failDirectorySync = true)
        val store = EncryptedStateStore(directory, TestStateCryptography, files)

        assertFailsWith<IOException> { store.write(DurableState()) }

        assertEquals(listOf("write", "replace", "sync-directory"), files.operations)
    }

    private object TestStateCryptography : StateCryptography {
        override fun encrypt(plaintext: ByteArray): ByteArray = byteArrayOf(1) + ByteArray(12) + plaintext
        override fun decrypt(ciphertext: ByteArray): ByteArray = ciphertext.copyOfRange(13, ciphertext.size)
    }

    private class RecordingAtomicStateFileWriter(
        private val failDirectorySync: Boolean = false,
    ) : AtomicStateFileWriter {
        val operations = mutableListOf<String>()

        override fun writeAndSync(file: File, bytes: ByteArray) {
            operations += "write"
            file.writeBytes(bytes)
        }

        override fun replace(temporary: File, target: File) {
            operations += "replace"
            Files.move(temporary.toPath(), target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        }

        override fun syncDirectory(directory: File) {
            operations += "sync-directory"
            if (failDirectorySync) throw IOException("directory sync failed")
        }
    }
}
