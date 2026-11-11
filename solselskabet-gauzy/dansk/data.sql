-- Danske navne på Gauzys standarddata (rapporter, prioriteter, størrelser, opgavetyper).
-- Kun visningsnavne ændres; de interne værdier (value-kolonner) er uændrede.
-- Køres af start.sh efter seed. Kan køres flere gange.

UPDATE report_category SET name = CASE name
	WHEN 'Time Tracking' THEN 'Tidsregistrering'
	WHEN 'Payments' THEN 'Betalinger'
	WHEN 'Time Off' THEN 'Fravær'
	WHEN 'Invoicing' THEN 'Fakturering'
	ELSE name END;

UPDATE report SET
	name = CASE name
		WHEN 'Time & Activity' THEN 'Tid og aktivitet'
		WHEN 'Weekly' THEN 'Ugentlig'
		WHEN 'Apps & URLs' THEN 'Apps og URL''er'
		WHEN 'Manual time edits' THEN 'Manuelle tidsrettelser'
		WHEN 'Expense' THEN 'Udgifter'
		WHEN 'Amounts owed' THEN 'Skyldige beløb'
		WHEN 'Payments' THEN 'Betalinger'
		WHEN 'Weekly limits' THEN 'Ugentlige grænser'
		WHEN 'Daily limits' THEN 'Daglige grænser'
		WHEN 'Project budgets' THEN 'Projektbudgetter'
		WHEN 'Client budgets' THEN 'Kundebudgetter'
		ELSE name END,
	description = CASE description
		WHEN 'See team members'' time worked, activity levels, and amounts earned per project or task' THEN 'Se medarbejdernes arbejdstid, aktivitetsniveau og indtjening pr. projekt eller opgave'
		WHEN 'See team members'' time worked, activity levels, and amount earned per week' THEN 'Se medarbejdernes arbejdstid, aktivitetsniveau og indtjening pr. uge'
		WHEN 'See team members'' apps used and URLs visited while working' THEN 'Se hvilke apps og websider medarbejderne har brugt under arbejdet'
		WHEN 'See team members'' time worked, project, task, and reason for each manual time entry' THEN 'Se arbejdstid, projekt, opgave og begrundelse for hver manuel tidsregistrering'
		WHEN 'See how much has been spent on expenses by member and project.' THEN 'Se hvor meget der er brugt på udgifter pr. medarbejder og projekt.'
		WHEN 'See how much team members are currently owed' THEN 'Se hvor meget medarbejderne har til gode'
		WHEN 'See how much team members were paid over a given period' THEN 'Se hvor meget medarbejderne har fået udbetalt i en periode'
		WHEN 'See team members'' weekly limits usage' THEN 'Se medarbejdernes forbrug af ugentlige grænser'
		WHEN 'See team members'' daily limits usage' THEN 'Se medarbejdernes forbrug af daglige grænser'
		WHEN 'See how much of your projects'' budgets have been spent' THEN 'Se hvor meget af projekternes budgetter der er brugt'
		WHEN 'See how much of your clients'' budgets have been spent' THEN 'Se hvor meget af kundernes budgetter der er brugt'
		ELSE description END;

UPDATE task_priority SET name = CASE name
	WHEN 'Urgent' THEN 'Haster' WHEN 'High' THEN 'Høj' WHEN 'Medium' THEN 'Middel' WHEN 'Low' THEN 'Lav' ELSE name END;

UPDATE task_size SET name = CASE name
	WHEN 'X-large' THEN 'Meget stor' WHEN 'Large' THEN 'Stor' WHEN 'Medium' THEN 'Mellem' WHEN 'Small' THEN 'Lille' WHEN 'Tiny' THEN 'Meget lille' ELSE name END;

UPDATE issue_type SET name = CASE name
	WHEN 'Task' THEN 'Opgave' WHEN 'Bug' THEN 'Fejl' WHEN 'Story' THEN 'Historie' WHEN 'Epic' THEN 'Epic' WHEN 'Memo' THEN 'Notat' ELSE name END;

-- Nyhedskort på overblikket ("Hvad er nyt")
UPDATE changelog SET
	title = CASE title
		WHEN 'Meet your AI Assistant' THEN 'Mød din AI-assistent'
		WHEN 'Documents hub' THEN 'Dokumentcenter'
		WHEN 'Custom dashboards' THEN 'Egne overblik'
		WHEN 'A faster, cleaner interface' THEN 'En hurtigere og enklere brugerflade'
		WHEN 'AI at work' THEN 'AI i arbejdet'
		WHEN 'Everything your business needs' THEN 'Alt hvad virksomheden har brug for'
		WHEN 'Open source, your way' THEN 'Open source på din måde'
		ELSE title END,
	content = CASE title
		WHEN 'Meet your AI Assistant' THEN 'Chat med en AI-agent, der kender dit arbejdsområde: den kan navigere mellem sider, læse data, udfylde formularer og besvare spørgsmål – med diktering og vedhæftede filer.'
		WHEN 'Documents hub' THEN 'Upload, organiser og del virksomhedens filer og wikisider – og vedhæft ethvert dokument i AI-chatten for at drøfte det.'
		WHEN 'Custom dashboards' THEN 'Byg dine egne overblik: træk widgets ind fra paletten, indstil hver enkelt, og skift mellem navngivne layouts.'
		WHEN 'A faster, cleaner interface' THEN 'Ny navigation, tættere tabeller, opdaterede mørke temaer og en AI-chatkolonne i fuld højde i hele programmet.'
		WHEN 'AI at work' THEN 'En indbygget AI-assistent, der kender dit arbejdsområde: chat, diktér, vedhæft dokumenter og lad den klikke for dig.'
		WHEN 'Everything your business needs' THEN 'ERP, CRM, HR, rekruttering og projektstyring med indbygget tidsregistrering – én åben platform.'
		WHEN 'Open source, your way' THEN 'AGPL-licenseret og gratis at drive selv, med dokumentation af alle funktioner.'
		ELSE content END;

-- 24-timers ur som i Danmark
UPDATE "user" SET "timeFormat" = '24';
UPDATE organization SET "timeFormat" = '24';

-- Solselskabets navn og logo i Gauzy (arbejdsområde og organisation)
UPDATE tenant SET name = 'Solselskabet', logo = 'assets/images/logos/solselskabet-ikon.svg' WHERE name IN ('Default Tenant', 'Ever');
UPDATE organization SET "imageUrl" = 'assets/images/logos/solselskabet-ikon.svg' WHERE name = 'Coop × Solselskabet';

-- Alle brugere lander i Coop × Solselskabet efter login
UPDATE "user" SET "defaultOrganizationId" = o.id, "lastOrganizationId" = o.id
FROM organization o WHERE o.name = 'Coop × Solselskabet' AND o."tenantId" = "user"."tenantId";

-- Coop × Solselskabet er standardorganisationen; den tomme "Default Company" skjules
UPDATE organization SET "isDefault" = (name = 'Coop × Solselskabet')
WHERE "tenantId" IN (SELECT "tenantId" FROM organization WHERE name = 'Coop × Solselskabet');
UPDATE organization SET "isActive" = false
WHERE name = 'Default Company' AND "tenantId" IN (SELECT "tenantId" FROM organization WHERE name = 'Coop × Solselskabet')
  AND NOT EXISTS (SELECT 1 FROM task t WHERE t."organizationId" = organization.id);
UPDATE user_organization uo SET "isDefault" = (o.name = 'Coop × Solselskabet'),
	"isActive" = (o.name <> 'Default Company' OR NOT EXISTS (
		SELECT 1 FROM user_organization x JOIN organization c ON c.id = x."organizationId"
		WHERE x."userId" = uo."userId" AND c.name = 'Coop × Solselskabet'))
FROM organization o WHERE o.id = uo."organizationId";

-- Gauzy åbner den organisation, brugerens medarbejderpost hører til: flyt dem fra den tomme "Default Company"
UPDATE employee e SET "organizationId" = c.id
FROM organization d, organization c
WHERE e."organizationId" = d.id AND d.name = 'Default Company'
  AND c.name = 'Coop × Solselskabet' AND c."tenantId" = d."tenantId";
