package com.pli.kiosk.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.system.Os
import android.system.OsConstants
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal interface StateCryptography {
    fun encrypt(plaintext: ByteArray): ByteArray
    fun decrypt(ciphertext: ByteArray): ByteArray
}

/** Performs the durable file-system operations in the order required for an atomic replacement. */
internal interface AtomicStateFileWriter {
    fun writeAndSync(file: File, bytes: ByteArray)
    fun replace(temporary: File, target: File)
    fun syncDirectory(directory: File)
}

/**
 * A private, no-backup encrypted snapshot. A missing key beside existing ciphertext is corruption,
 * not a reason to replace the state. The coordinator turns every error into a fail-closed state.
 */
class EncryptedStateStore private constructor(
    private val directory: File,
    private val stateFile: File,
    private val cryptography: StateCryptography,
    private val fileWriter: AtomicStateFileWriter,
) : StateStore {
    constructor(context: Context) : this(
        context.noBackupFilesDir,
        File(context.noBackupFilesDir, STATE_FILE_NAME),
        KeystoreStateCryptography(KEY_ALIAS),
        AndroidAtomicStateFileWriter,
    )

    internal constructor(
        directory: File,
        cryptography: StateCryptography,
        fileWriter: AtomicStateFileWriter,
    ) : this(directory, File(directory, STATE_FILE_NAME), cryptography, fileWriter)

    override fun read(): DurableState {
        if (!stateFile.exists()) return DurableState()
        val encrypted = try {
            stateFile.readBytes()
        } catch (error: Exception) {
            throw IOException("Unable to read durable state", error)
        }
        if (encrypted.size <= IV_BYTES + VERSION_BYTES) throw IOException("Encrypted state is truncated")
        val plaintext = try {
            cryptography.decrypt(encrypted)
        } catch (error: Exception) {
            throw IOException("Encrypted state cannot be opened", error)
        }
        return try {
            decode(String(plaintext, Charsets.UTF_8))
        } catch (error: Exception) {
            throw IOException("Encrypted state is malformed", error)
        }
    }

    override fun write(state: DurableState) {
        val bytes = try {
            cryptography.encrypt(encode(state).toByteArray(Charsets.UTF_8))
        } catch (error: Exception) {
            throw IOException("Unable to encrypt durable state", error)
        }
        if (!directory.exists() && !directory.mkdirs()) throw IOException("No private state directory")
        val temporary = File.createTempFile("internal-purchase-", ".pending", directory)
        try {
            fileWriter.writeAndSync(temporary, bytes)
            fileWriter.replace(temporary, stateFile)
            // The renamed entry is not crash-durable until its containing directory is synced.
            fileWriter.syncDirectory(directory)
            // Verify the atomically replaced bytes before reporting a durable write to the coordinator.
            if (read() != state) throw IOException("Durable state verification failed")
        } catch (error: Exception) {
            // Do not delete either old ciphertext or an unverified temporary ciphertext here.
            throw if (error is IOException) error else IOException("Atomic durable-state replacement failed", error)
        }
    }

    private class KeystoreStateCryptography(
        private val keyAlias: String,
    ) : StateCryptography {
        override fun encrypt(plaintext: ByteArray): ByteArray {
            val iv = ByteArray(IV_BYTES).also(SecureRandom()::nextBytes)
            val cipher = Cipher.getInstance(CIPHER).apply {
                init(Cipher.ENCRYPT_MODE, key(existingKey = false), GCMParameterSpec(TAG_BITS, iv))
            }
            return byteArrayOf(VERSION) + iv + cipher.doFinal(plaintext)
        }

        override fun decrypt(ciphertext: ByteArray): ByteArray {
            if (ciphertext[0] != VERSION) throw IOException("Unsupported state version")
            val iv = ciphertext.copyOfRange(VERSION_BYTES, VERSION_BYTES + IV_BYTES)
            val payload = ciphertext.copyOfRange(VERSION_BYTES + IV_BYTES, ciphertext.size)
            return Cipher.getInstance(CIPHER).apply {
                init(Cipher.DECRYPT_MODE, key(existingKey = true), GCMParameterSpec(TAG_BITS, iv))
            }.doFinal(payload)
        }

        private fun key(existingKey: Boolean): SecretKey {
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            val existing = keyStore.getKey(keyAlias, null) as? SecretKey
            if (existing != null) return existing
            if (existingKey) throw IOException("Keystore key is missing")
            val generator = javax.crypto.KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            generator.init(
                KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
            return generator.generateKey()
        }
    }

    private object AndroidAtomicStateFileWriter : AtomicStateFileWriter {
        override fun writeAndSync(file: File, bytes: ByteArray) {
            FileOutputStream(file).use { output ->
                output.write(bytes)
                output.flush()
                output.fd.sync()
            }
        }

        override fun replace(temporary: File, target: File) {
            Files.move(
                temporary.toPath(),
                target.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        }

        override fun syncDirectory(directory: File) {
            val descriptor = Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
            try {
                Os.fsync(descriptor)
            } finally {
                Os.close(descriptor)
            }
        }
    }

    private fun encode(state: DurableState): String = JSONObject().apply {
        put("session", state.session?.let(::sessionJson) ?: JSONObject.NULL)
        put("attempt", state.attempt?.let(::attemptJson) ?: JSONObject.NULL)
    }.toString()

    private fun sessionJson(session: StaffSession): JSONObject = JSONObject().apply {
        put("origin", session.origin)
        put("association", session.association)
        put("cookie", session.cookie)
        put("expiresAt", session.expiresAt)
    }

    private fun attemptJson(attempt: AttemptState): JSONObject = JSONObject().apply {
        put("ticket", attempt.ticket?.let(::ticketJson) ?: JSONObject.NULL)
        put("sessionAssociation", attempt.sessionAssociation)
        put("origin", attempt.origin)
        put("paymentIntentId", attempt.paymentIntentId ?: JSONObject.NULL)
        put("resolved", attempt.resolved)
    }

    private fun ticketJson(ticket: AttemptTicket): JSONObject = JSONObject().apply {
        put("value", ticket.value)
        put("expiresAt", ticket.expiresAt)
        put("readerId", ticket.readerId)
        put("locationId", ticket.locationId)
    }

    private fun decode(value: String): DurableState {
        val root = JSONObject(value)
        val session = nullableObject(root, "session")?.let(::decodeSession)
        val attempt = nullableObject(root, "attempt")?.let(::decodeAttempt)
        return DurableState(session, attempt)
    }

    private fun decodeSession(value: JSONObject): StaffSession = StaffSession(
        requiredString(value, "origin"),
        requiredString(value, "association"),
        requiredString(value, "cookie"),
        requiredLong(value, "expiresAt"),
    )

    private fun decodeAttempt(value: JSONObject): AttemptState = AttemptState(
        nullableObject(value, "ticket")?.let(::decodeTicket),
        requiredString(value, "sessionAssociation"),
        requiredString(value, "origin"),
        nullableString(value, "paymentIntentId"),
        requiredBoolean(value, "resolved"),
    )

    private fun decodeTicket(value: JSONObject): AttemptTicket = AttemptTicket(
        requiredString(value, "value"),
        requiredLong(value, "expiresAt"),
        requiredString(value, "readerId"),
        requiredString(value, "locationId"),
    )

    private fun nullableObject(value: JSONObject, key: String): JSONObject? {
        require(value.has(key)) { "Missing $key" }
        val result = value.opt(key)
        return when (result) {
            JSONObject.NULL -> null
            is JSONObject -> result
            else -> throw IllegalArgumentException("Invalid $key")
        }
    }

    private fun nullableString(value: JSONObject, key: String): String? {
        require(value.has(key)) { "Missing $key" }
        val result = value.opt(key)
        return when (result) {
            JSONObject.NULL -> null
            is String -> result
            else -> throw IllegalArgumentException("Invalid $key")
        }
    }

    private fun requiredString(value: JSONObject, key: String): String {
        val result = value.opt(key)
        require(result is String && result.isNotBlank()) { "Invalid $key" }
        return result
    }

    private fun requiredLong(value: JSONObject, key: String): Long {
        val result = value.opt(key)
        require(result is Number) { "Invalid $key" }
        return result.toLong()
    }

    private fun requiredBoolean(value: JSONObject, key: String): Boolean {
        val result = value.opt(key)
        require(result is Boolean) { "Invalid $key" }
        return result
    }

    private companion object {
        const val STATE_FILE_NAME = "internal-purchase-state.v1"
        const val KEY_ALIAS = "pli.internal.purchase.state.v1"
        const val CIPHER = "AES/GCM/NoPadding"
        const val VERSION: Byte = 1
        const val VERSION_BYTES = 1
        const val IV_BYTES = 12
        const val TAG_BITS = 128
    }
}
