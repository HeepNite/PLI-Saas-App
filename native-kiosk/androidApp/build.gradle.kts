import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val approvedHttpsOrigin = providers.gradleProperty("PLI_APPROVED_HTTPS_ORIGIN").orElse("").get()
val nativeCollectionEnabled = providers.gradleProperty("PLI_NATIVE_COLLECTION_ENABLED").map { it == "true" }.orElse(false).get()
val readerProvisioningEnabled = providers.gradleProperty("PLI_READER_PROVISIONING_ENABLED").map { it == "true" }.orElse(false).get()
require(!(nativeCollectionEnabled && readerProvisioningEnabled)) { "Provisioning and collection build modes are mutually exclusive" }
val provisioningConnectionTokens = if (readerProvisioningEnabled) {
    val tokenPath = providers.gradleProperty("PLI_PROVISIONING_CONNECTION_TOKEN_FILE").orNull
        ?: error("Provisioning requires a private connection-token file")
    file(tokenPath).readLines().map(String::trim).filter(String::isNotEmpty).also { tokens ->
        require(tokens.size in 3..12 && tokens.distinct().size == tokens.size) { "Provisioning requires 3-12 unique connection tokens" }
        require(tokens.all { it.matches(Regex("pst_[A-Za-z0-9_]+")) }) { "Invalid provisioning connection token" }
    }.joinToString("\\n")
} else ""

android {
    namespace = "com.pli.kiosk.android"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.pli.kiosk.livefoundation"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Deliberately blank/OFF until an approved build supplies both non-secret values.
        buildConfigField("String", "APPROVED_HTTPS_ORIGIN", "\"$approvedHttpsOrigin\"")
        buildConfigField("boolean", "NATIVE_COLLECTION_ENABLED", nativeCollectionEnabled.toString())
        buildConfigField("boolean", "READER_PROVISIONING_ENABLED", readerProvisioningEnabled.toString())
        buildConfigField("String", "PROVISIONING_CONNECTION_TOKENS", "\"$provisioningConnectionTokens\"")
        manifestPlaceholders["launcherActivity"] = if (readerProvisioningEnabled) {
            "com.pli.kiosk.android.ReaderProvisioningActivity"
        } else {
            "com.pli.kiosk.android.OperatorActivity"
        }
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions.unitTests.isIncludeAndroidResources = true
}
kotlin.compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
dependencies {
    implementation("com.stripe:stripeterminal:5.6.0")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
}
