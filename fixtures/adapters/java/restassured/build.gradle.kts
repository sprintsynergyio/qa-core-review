plugins {
    java
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation("org.testng:testng:7.10.2")
    testImplementation("io.rest-assured:rest-assured:5.5.0")
}

tasks.test {
    useTestNG()
}
