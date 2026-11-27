package shop;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.*;
import org.opentest4j.TestAbortedException;

// Wildcard imports: the names are found through the packages.
class ConditionsTest {
    @Test
    @DisabledOnOs(value = OS.WINDOWS, disabledReason = "the file picker is not supported on Windows")
    void uploadsAnAvatar() {
        assertTrue(Shop.upload("avatar.png").ok());
    }

    @Test
    @EnabledOnOs(OS.LINUX)
    void usesAPasskey() {
        assertTrue(Shop.login("standard_user", true).ok());
    }

    @Test
    @DisabledOnJre(JRE.JAVA_17)
    void formatsWithTheNewApi() {
        assertEquals("$29.99", Shop.format(29.99));
    }

    @Test
    @EnabledOnJre(JRE.JAVA_21)
    void usesVirtualThreads() {
        assertTrue(Shop.parallel().ok());
    }

    @Test
    @DisabledForJreRange(min = JRE.JAVA_8, max = JRE.JAVA_11)
    void readsRecords() {
        assertEquals(3, Shop.orders().size());
    }

    @Test
    @EnabledForJreRange(min = JRE.JAVA_17)
    void readsSealedTypes() {
        assertEquals(2, Shop.payments().size());
    }

    @Test
    @DisabledIf("isOffline")
    void syncsTheCatalog() {
        assertTrue(Shop.sync().ok());
    }

    @Test
    @EnabledIf(value = "hasDocker", disabledReason = "Docker is needed for the database")
    void savesTheOrder() {
        assertTrue(Shop.save(7).ok());
    }

    @Test
    @DisabledIfSystemProperty(named = "ci", matches = "true")
    void opensTheBrowser() {
        assertTrue(Shop.open().ok());
    }

    @Test
    @EnabledIfSystemProperty(named = "os.arch", matches = ".*64.*")
    void loadsTheNativeLibrary() {
        assertTrue(Shop.nativeLibrary().ok());
    }

    @Test
    @DisabledIfEnvironmentVariable(named = "CI", matches = "true")
    void sendsARealMail() {
        assertTrue(Shop.mail("order 7 placed").ok());
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "PAYMENTS", matches = "on")
    void chargesTheCard() {
        assertTrue(Shop.charge(29.99).ok());
    }

    @Test
    @DisabledInNativeImage
    void readsAProxyClass() {
        assertNotNull(Shop.proxy());
    }

    @Test
    @EnabledInNativeImage
    void startsFast() {
        assertTrue(Shop.startupMillis() < 100);
    }

    @Test
    void refundsOnLinuxOnly() {
        assumeTrue(Shop.isLinux(), "refunds are tested on Linux only");
        assertEquals(29.99, Shop.refund(7).amount());
    }

    @Test
    void skipsWhenTheFlagIsOff() {
        assumeFalse(Shop.flag("refunds").isOff());
        Assumptions.assumeTrue(Shop.hasDatabase());
        assertEquals("refunded", Shop.refund(8).status());
    }

    @Test
    void isNotWrittenYet() {
        abort("the export is not ready");
    }

    @Test
    void abortsOnOldData() {
        if (Shop.dataVersion() < 3) {
            throw new TestAbortedException("old data");
        }
        assertEquals(3, Shop.orders().size());
    }

    @Test
    void alwaysAborts() {
        throw new TestAbortedException("the importer is switched off");
    }

    boolean isOffline() {
        return Shop.ping() == null;
    }

    boolean hasDocker() {
        return Shop.docker() != null;
    }
}
