import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// ─── SKR03 Kontenrahmen ───────────────────────────────────────────
const SKR03 = [
  // Klasse 0: Anlage- und Kapitalkonten
  { number: "0010", name: "Grundstücke", type: "ASSET", category: "ANLAGE" },
  { number: "0027", name: "Gebäude", type: "ASSET", category: "ANLAGE" },
  { number: "0200", name: "Technische Anlagen und Maschinen", type: "ASSET", category: "ANLAGE" },
  { number: "0320", name: "PKW", type: "ASSET", category: "ANLAGE" },
  { number: "0410", name: "Geschäftsausstattung", type: "ASSET", category: "ANLAGE" },
  { number: "0420", name: "Büroeinrichtung", type: "ASSET", category: "ANLAGE" },
  { number: "0480", name: "GWG (Geringwertige Wirtschaftsgüter)", type: "ASSET", category: "ANLAGE" },
  { number: "0650", name: "EDV-Software", type: "ASSET", category: "ANLAGE" },

  // Klasse 1: Finanz- und Privatkonten
  { number: "1000", name: "Kasse", type: "ASSET", category: "UMLAUF" },
  { number: "1200", name: "Bank", type: "ASSET", category: "UMLAUF" },
  { number: "1210", name: "Bank 2", type: "ASSET", category: "UMLAUF" },
  { number: "1300", name: "Wechsel", type: "ASSET", category: "UMLAUF" },
  { number: "1400", name: "Forderungen aus Lieferungen und Leistungen", type: "ASSET", category: "UMLAUF" },
  { number: "1500", name: "Sonstige Vermögensgegenstände", type: "ASSET", category: "UMLAUF" },
  { number: "1548", name: "Vorsteuer laufendes Jahr", type: "ASSET", category: "UMLAUF" },
  { number: "1570", name: "Abziehbare Vorsteuer 7%", type: "ASSET", category: "UMLAUF" },
  { number: "1576", name: "Abziehbare Vorsteuer 19%", type: "ASSET", category: "UMLAUF" },
  { number: "1580", name: "Abziehbare Vorsteuer nach §13b UStG", type: "ASSET", category: "UMLAUF" },
  { number: "1590", name: "Durchlaufende Posten", type: "ASSET", category: "UMLAUF" },
  { number: "1600", name: "Verbindlichkeiten aus Lieferungen und Leistungen", type: "LIABILITY", category: "UMLAUF" },
  { number: "1700", name: "Sonstige Verbindlichkeiten", type: "LIABILITY", category: "UMLAUF" },
  { number: "1710", name: "Erhaltene Anzahlungen", type: "LIABILITY", category: "UMLAUF" },
  { number: "1740", name: "Verbindlichkeiten aus Steuern", type: "LIABILITY", category: "UMLAUF" },
  { number: "1755", name: "Lohnsteuerverbindlichkeiten", type: "LIABILITY", category: "UMLAUF" },
  { number: "1760", name: "Umsatzsteuerverbindlichkeiten", type: "LIABILITY", category: "UMLAUF" },
  { number: "1770", name: "Umsatzsteuer 7%", type: "LIABILITY", category: "UMLAUF" },
  { number: "1776", name: "Umsatzsteuer 19%", type: "LIABILITY", category: "UMLAUF" },
  { number: "1780", name: "Umsatzsteuer-Vorauszahlungen", type: "LIABILITY", category: "UMLAUF" },
  { number: "1790", name: "Umsatzsteuer laufendes Jahr", type: "LIABILITY", category: "UMLAUF" },
  { number: "1800", name: "Privatentnahmen allgemein", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "1890", name: "Privateinlagen", type: "EQUITY", category: "EIGENKAPITAL" },

  // Klasse 2: Eigenkapital
  { number: "2000", name: "Eigenkapital", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2100", name: "Gezeichnetes Kapital", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2900", name: "Gewinnvortrag", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2970", name: "Verlustvortrag", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2978", name: "Rückstellungen", type: "LIABILITY", category: "EIGENKAPITAL" },

  // Klasse 3: Wareneingangskonten
  { number: "3000", name: "Roh-, Hilfs- und Betriebsstoffe", type: "EXPENSE", category: "AUFWAND" },
  { number: "3100", name: "Fremdleistungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "3300", name: "Wareneinkauf 7% Vorsteuer", type: "EXPENSE", category: "AUFWAND" },
  { number: "3400", name: "Wareneinkauf 19% Vorsteuer", type: "EXPENSE", category: "AUFWAND" },

  // Klasse 4: Betriebliche Aufwendungen
  { number: "4100", name: "Löhne", type: "EXPENSE", category: "AUFWAND" },
  { number: "4120", name: "Gehälter", type: "EXPENSE", category: "AUFWAND" },
  { number: "4130", name: "Gesetzliche soziale Aufwendungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4200", name: "Raumkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4210", name: "Miete", type: "EXPENSE", category: "AUFWAND" },
  { number: "4220", name: "Nebenkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4240", name: "Heizung", type: "EXPENSE", category: "AUFWAND" },
  { number: "4250", name: "Strom", type: "EXPENSE", category: "AUFWAND" },
  { number: "4260", name: "Reinigung", type: "EXPENSE", category: "AUFWAND" },
  { number: "4300", name: "Versicherungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4360", name: "Beiträge", type: "EXPENSE", category: "AUFWAND" },
  { number: "4500", name: "Fahrzeugkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4510", name: "Kfz-Steuer", type: "EXPENSE", category: "AUFWAND" },
  { number: "4520", name: "Kfz-Versicherungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4530", name: "Laufende Kfz-Betriebskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4540", name: "Kfz-Reparaturen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4580", name: "Sonstige Fahrzeugkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4600", name: "Werbekosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4610", name: "Repräsentationskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4630", name: "Geschenke abzugsfähig", type: "EXPENSE", category: "AUFWAND" },
  { number: "4640", name: "Geschenke nicht abzugsfähig", type: "EXPENSE", category: "AUFWAND" },
  { number: "4650", name: "Bewirtungskosten 70%", type: "EXPENSE", category: "AUFWAND" },
  { number: "4654", name: "Bewirtungskosten nicht abzugsfähig", type: "EXPENSE", category: "AUFWAND" },
  { number: "4660", name: "Reisekosten Unternehmer", type: "EXPENSE", category: "AUFWAND" },
  { number: "4670", name: "Reisekosten Arbeitnehmer", type: "EXPENSE", category: "AUFWAND" },
  { number: "4700", name: "Kosten der Warenabgabe", type: "EXPENSE", category: "AUFWAND" },
  { number: "4800", name: "Porto", type: "EXPENSE", category: "AUFWAND" },
  { number: "4805", name: "Telefon", type: "EXPENSE", category: "AUFWAND" },
  { number: "4810", name: "Internet", type: "EXPENSE", category: "AUFWAND" },
  { number: "4815", name: "Mobilfunk", type: "EXPENSE", category: "AUFWAND" },
  { number: "4820", name: "Bürobedarf", type: "EXPENSE", category: "AUFWAND" },
  { number: "4830", name: "Zeitschriften, Bücher", type: "EXPENSE", category: "AUFWAND" },
  { number: "4855", name: "Nebenkosten des Geldverkehrs", type: "EXPENSE", category: "AUFWAND" },
  { number: "4900", name: "Sonstige betriebliche Aufwendungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4910", name: "Rechts- und Beratungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4920", name: "Buchführungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4930", name: "Abschluss- und Prüfungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4940", name: "Fortbildungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4945", name: "Fremdarbeiten/Fremdleistungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4946", name: "Subunternehmer", type: "EXPENSE", category: "AUFWAND" },
  { number: "4950", name: "Software/EDV-Kosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4955", name: "Cloud-/Hosting-Kosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "4970", name: "Abschreibungen auf Sachanlagen", type: "EXPENSE", category: "AUFWAND" },
  { number: "4980", name: "Abschreibungen auf GWG", type: "EXPENSE", category: "AUFWAND" },

  // Klasse 7
  { number: "7000", name: "Bestandsveränderungen", type: "EXPENSE", category: "AUFWAND" },

  // Klasse 8: Erlöskonten
  { number: "8100", name: "Erlöse 7% USt", type: "REVENUE", category: "ERLOES" },
  { number: "8200", name: "Erlöse Leistungen steuerfrei §4", type: "REVENUE", category: "ERLOES" },
  { number: "8300", name: "Erlöse Waren 19% USt", type: "REVENUE", category: "ERLOES" },
  { number: "8400", name: "Erlöse 19% USt", type: "REVENUE", category: "ERLOES" },
  { number: "8500", name: "Provisionserträge", type: "REVENUE", category: "ERLOES" },
  { number: "8519", name: "Erlöse Kleinunternehmer §19", type: "REVENUE", category: "ERLOES" },
  { number: "8611", name: "Steuerfreie innergemeinschaftliche Lieferung", type: "REVENUE", category: "ERLOES" },
  { number: "8700", name: "Erlösschmälerungen", type: "REVENUE", category: "ERLOES" },
  { number: "8800", name: "Sonstige betriebliche Erträge", type: "REVENUE", category: "ERLOES" },
  { number: "8900", name: "Zinserträge", type: "REVENUE", category: "ERLOES" },
  { number: "8920", name: "Erträge aus Anlagenabgängen", type: "REVENUE", category: "ERLOES" },

  // Klasse 9
  { number: "9000", name: "Saldenvorträge Sachkonten", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "9008", name: "Saldenvorträge Debitoren", type: "ASSET", category: "UMLAUF" },
  { number: "9009", name: "Saldenvorträge Kreditoren", type: "LIABILITY", category: "UMLAUF" },
];

// ─── SKR04 Kontenrahmen ───────────────────────────────────────────
const SKR04 = [
  { number: "0100", name: "Grundstücke", type: "ASSET", category: "ANLAGE" },
  { number: "0240", name: "Gebäude", type: "ASSET", category: "ANLAGE" },
  { number: "0500", name: "Maschinen", type: "ASSET", category: "ANLAGE" },
  { number: "0520", name: "PKW", type: "ASSET", category: "ANLAGE" },
  { number: "0650", name: "Büroeinrichtung", type: "ASSET", category: "ANLAGE" },
  { number: "0670", name: "GWG", type: "ASSET", category: "ANLAGE" },
  { number: "0690", name: "EDV-Software", type: "ASSET", category: "ANLAGE" },
  { number: "1200", name: "Forderungen aus L+L", type: "ASSET", category: "UMLAUF" },
  { number: "1400", name: "Abziehbare Vorsteuer 7%", type: "ASSET", category: "UMLAUF" },
  { number: "1406", name: "Abziehbare Vorsteuer 19%", type: "ASSET", category: "UMLAUF" },
  { number: "1408", name: "Vorsteuer nach §13b", type: "ASSET", category: "UMLAUF" },
  { number: "1600", name: "Kasse", type: "ASSET", category: "UMLAUF" },
  { number: "1800", name: "Bank", type: "ASSET", category: "UMLAUF" },
  { number: "1810", name: "Bank 2", type: "ASSET", category: "UMLAUF" },
  { number: "2000", name: "Eigenkapital", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2100", name: "Gezeichnetes Kapital", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2900", name: "Privatentnahmen", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "2950", name: "Privateinlagen", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "3300", name: "Verbindlichkeiten aus L+L", type: "LIABILITY", category: "UMLAUF" },
  { number: "3500", name: "Sonstige Verbindlichkeiten", type: "LIABILITY", category: "UMLAUF" },
  { number: "3700", name: "Verbindlichkeiten aus Steuern", type: "LIABILITY", category: "UMLAUF" },
  { number: "3800", name: "Umsatzsteuer 7%", type: "LIABILITY", category: "UMLAUF" },
  { number: "3806", name: "Umsatzsteuer 19%", type: "LIABILITY", category: "UMLAUF" },
  { number: "3820", name: "Umsatzsteuer-Vorauszahlung", type: "LIABILITY", category: "UMLAUF" },
  { number: "4100", name: "Erlöse 7% USt", type: "REVENUE", category: "ERLOES" },
  { number: "4200", name: "Erlöse steuerfrei §4", type: "REVENUE", category: "ERLOES" },
  { number: "4300", name: "Erlöse 19% USt", type: "REVENUE", category: "ERLOES" },
  { number: "4400", name: "Erlöse 19% USt", type: "REVENUE", category: "ERLOES" },
  { number: "4519", name: "Erlöse Kleinunternehmer §19", type: "REVENUE", category: "ERLOES" },
  { number: "4700", name: "Sonstige betriebliche Erträge", type: "REVENUE", category: "ERLOES" },
  { number: "4800", name: "Zinserträge", type: "REVENUE", category: "ERLOES" },
  { number: "5000", name: "Materialaufwand", type: "EXPENSE", category: "AUFWAND" },
  { number: "5100", name: "Fremdleistungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "5300", name: "Wareneinkauf 7%", type: "EXPENSE", category: "AUFWAND" },
  { number: "5400", name: "Wareneinkauf 19%", type: "EXPENSE", category: "AUFWAND" },
  { number: "6000", name: "Löhne", type: "EXPENSE", category: "AUFWAND" },
  { number: "6020", name: "Gehälter", type: "EXPENSE", category: "AUFWAND" },
  { number: "6100", name: "Soziale Abgaben", type: "EXPENSE", category: "AUFWAND" },
  { number: "6200", name: "Abschreibungen auf Sachanlagen", type: "EXPENSE", category: "AUFWAND" },
  { number: "6220", name: "Abschreibungen auf GWG", type: "EXPENSE", category: "AUFWAND" },
  { number: "6300", name: "Sonstige betriebliche Aufwendungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "6310", name: "Miete", type: "EXPENSE", category: "AUFWAND" },
  { number: "6320", name: "Nebenkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6330", name: "Heizung/Strom", type: "EXPENSE", category: "AUFWAND" },
  { number: "6400", name: "Versicherungen", type: "EXPENSE", category: "AUFWAND" },
  { number: "6500", name: "Fahrzeugkosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6600", name: "Werbekosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6640", name: "Bewirtungskosten 70%", type: "EXPENSE", category: "AUFWAND" },
  { number: "6650", name: "Reisekosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6800", name: "Porto", type: "EXPENSE", category: "AUFWAND" },
  { number: "6805", name: "Telefon", type: "EXPENSE", category: "AUFWAND" },
  { number: "6810", name: "Internet", type: "EXPENSE", category: "AUFWAND" },
  { number: "6815", name: "Bürobedarf", type: "EXPENSE", category: "AUFWAND" },
  { number: "6820", name: "Nebenkosten des Geldverkehrs", type: "EXPENSE", category: "AUFWAND" },
  { number: "6825", name: "Rechts-/Beratungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6830", name: "Buchführungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6835", name: "Fortbildungskosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "6840", name: "Software/EDV-Kosten", type: "EXPENSE", category: "AUFWAND" },
  { number: "9000", name: "Saldenvorträge Sachkonten", type: "EQUITY", category: "EIGENKAPITAL" },
];

async function main() {
  console.log("Seeding ARCANA database...\n");

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      name: "ARCANA Demo GmbH",
      legalForm: "GmbH",
      taxId: "12/345/67890",
      ustId: "DE123456789",
      street: "Musterstr. 1",
      city: "Berlin",
      zip: "10115",
      chartOfAccounts: "SKR03",
      accountingMethod: "BILANZ",
    },
  });
  console.log(`  Organization: ${org.name} (${org.id})`);

  // Create demo user
  const passwordHash = await hash("arcana2024", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@arcana.de",
      name: "Demo Benutzer",
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
    },
  });
  console.log(`  User: ${user.email}`);

  // Seed SKR03 accounts
  const skr03Accounts = await Promise.all(
    SKR03.map((acc) =>
      prisma.account.create({
        data: {
          organizationId: org.id,
          number: acc.number,
          name: acc.name,
          type: acc.type,
          category: acc.category,
          isSystem: true,
        },
      })
    )
  );
  console.log(`  SKR03: ${skr03Accounts.length} Konten angelegt`);

  // Create second org with SKR04
  const org2 = await prisma.organization.create({
    data: {
      name: "Julian Polleschner EU",
      legalForm: "EU",
      chartOfAccounts: "SKR04",
      accountingMethod: "EUR",
      street: "Beispielweg 5",
      city: "Berlin",
      zip: "10999",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "julian@arcana.de",
      name: "Julian Polleschner",
      passwordHash,
      role: "OWNER",
      organizationId: org2.id,
    },
  });
  console.log(`  Organization: ${org2.name} (${org2.id})`);
  console.log(`  User: ${user2.email}`);

  const skr04Accounts = await Promise.all(
    SKR04.map((acc) =>
      prisma.account.create({
        data: {
          organizationId: org2.id,
          number: acc.number,
          name: acc.name,
          type: acc.type,
          category: acc.category,
          isSystem: true,
        },
      })
    )
  );
  console.log(`  SKR04: ${skr04Accounts.length} Konten angelegt`);

  // Create bank account for demo org
  const bankKonto = skr03Accounts.find((a) => a.number === "1200")!;
  await prisma.bankAccount.create({
    data: {
      organizationId: org.id,
      name: "Geschaeftskonto",
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      accountId: bankKonto.id,
    },
  });
  console.log("  Bankkonto verknuepft (1200 Bank)");

  console.log("\nSeed complete!");
  console.log("Login: demo@arcana.de / arcana2024");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
