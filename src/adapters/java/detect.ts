// Java: which files are tests and how a project shows its frameworks (SPEC.md Sections 7.4, 9.3).
// The parser half of the adapter is added in Milestone 14. Build files are read as text and
// searched for Maven and Gradle coordinates. Maven and Gradle are never run.
import { detectFromMarkers } from '../../detect/markers.js';
import type { AdapterProfile, FrameworkDescriptor, ProjectMarker } from '../types.js';

const BUILD_FILES = ['pom.xml', 'build.gradle', 'build.gradle.kts'];
const declares = (...names: string[]): ProjectMarker[] => names.flatMap((contains) => BUILD_FILES.map((file) => ({ file, contains })));

const frameworks: FrameworkDescriptor[] = [
  {
    id: 'junit5',
    role: 'runner',
    displayName: 'JUnit 5',
    // spring-boot-starter-test brings JUnit 5 with it.
    projectMarkers: declares('org.junit.jupiter', 'junit-jupiter', 'junit-jupiter-api', 'junit-jupiter-engine', 'spring-boot-starter-test'),
    fileMarkers: ['org.junit.jupiter'],
  },
  // The bare name `junit` is the JUnit 4 artifact (`junit:junit`).
  { id: 'junit4', role: 'runner', displayName: 'JUnit 4', projectMarkers: declares('junit', 'junit-vintage-engine'), fileMarkers: ['org.junit.Test'] },
  { id: 'testng', role: 'runner', displayName: 'TestNG', projectMarkers: declares('org.testng', 'testng'), fileMarkers: ['org.testng'] },
  { id: 'selenium', role: 'library', displayName: 'Selenium', projectMarkers: declares('org.seleniumhq.selenium', 'selenium-java'), fileMarkers: ['org.openqa.selenium'] },
  { id: 'restassured', role: 'library', displayName: 'REST Assured', projectMarkers: declares('io.rest-assured', 'rest-assured'), fileMarkers: ['io.restassured'] },
  { id: 'playwright-java', role: 'library', displayName: 'Playwright for Java', projectMarkers: declares('com.microsoft.playwright'), fileMarkers: ['com.microsoft.playwright'] },
  { id: 'cucumber', role: 'library', displayName: 'Cucumber', projectMarkers: declares('io.cucumber', 'cucumber-java'), fileMarkers: ['io.cucumber'] },
];

export const javaProfile: AdapterProfile = {
  id: 'java',
  tier: 1,
  languages: ['java'],
  extensions: ['.java'],
  frameworks,
  defaultInclude: ['**/src/test/java/**/*.java', '**/*Test.java', '**/*Tests.java', '**/*IT.java', '**/Test*.java'],
  defaultExclude: [],
  languageOf: () => 'java',
  detectProject: (probe) => detectFromMarkers(probe, javaProfile, { manifests: BUILD_FILES, weakManifests: ['settings.gradle', 'settings.gradle.kts'] }),
};
