// How a language is written in messages and reports.

/** A language that is not here (a Tier 3 hint such as 'scala') gets a capital letter. */
export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', csharp: 'C#', go: 'Go', ruby: 'Ruby', kotlin: 'Kotlin', php: 'PHP',
  robot: 'Robot Framework', gherkin: 'Gherkin', jmeter: 'JMeter', postman: 'Postman',
  cpp: 'C++', 'objective-c': 'Objective-C', powershell: 'PowerShell',
};
export const languageName = (id: string): string => LANGUAGE_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
