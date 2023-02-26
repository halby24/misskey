process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import rndstr from 'rndstr';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';

import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { ApActorService } from '@/core/activitypub/models/ApActorService.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { MockResolver } from '../misc/mock-resolver.js';

describe('ActivityPub', () => {
	let noteService: ApNoteService;
	let actorService: ApActorService;
	let resolver: MockResolver;

	beforeEach(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();

		await app.init();
		app.enableShutdownHooks();

		noteService = app.get<ApNoteService>(ApNoteService);
		actorService = app.get<ApActorService>(ApActorService);
		resolver = new MockResolver(await app.resolve<LoggerService>(LoggerService));

		// Prevent ApPersonService from fetching instance, as it causes Jest import-after-test error
		const federatedInstanceService = app.get<FederatedInstanceService>(FederatedInstanceService);
		jest.spyOn(federatedInstanceService, 'fetch').mockImplementation(() => new Promise(() => {}));
	});

	describe('Parse minimum object', () => {
		const host = 'https://host1.test';
		const preferredUsername = `${rndstr('A-Z', 4)}${rndstr('a-z', 4)}`;
		const personActorId = `${host}/users/${preferredUsername.toLowerCase()}`;

		const person = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: personActorId,
			type: 'Person',
			preferredUsername,
			inbox: `${personActorId}/inbox`,
			outbox: `${personActorId}/outbox`,
		};

		const groupActorId = `${host}/channels/${rndstr('0-9a-z', 8)}`;
		const group = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: groupActorId,
			type: 'Group',
			inbox: `${groupActorId}/inbox`,
			outbox: `${groupActorId}/outbox`,
		};

		const post = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: `${host}/users/${rndstr('0-9a-z', 8)}`,
			type: 'Note',
			attributedTo: person.id,
			to: 'https://www.w3.org/ns/activitystreams#Public',
			content: 'あ',
		};

		test('Minimum Person', async () => {
			resolver._register(person.id, person);

			const user = await actorService.createPerson(person.id, resolver);

			assert.deepStrictEqual(user.uri, person.id);
			assert.deepStrictEqual(user.username, person.preferredUsername);
			assert.deepStrictEqual(user.inbox, person.inbox);
		});

		test('Minimum Group', async () => {
			resolver._register(group.id, group);

			const channel = await actorService.createGroup(group.id, resolver);

			assert.deepStrictEqual(channel.uri, group.id);
			assert.deepStrictEqual(channel.inbox, group.inbox);
		});

		test('Minimum Note', async () => {
			resolver._register(person.id, person);
			resolver._register(post.id, post);

			const note = await noteService.createNote(post.id, resolver, true);

			assert.deepStrictEqual(note?.uri, post.id);
			assert.deepStrictEqual(note.visibility, 'public');
			assert.deepStrictEqual(note.text, post.content);
		});
	});

	describe('Truncate long name', () => {
		const host = 'https://host1.test';
		const preferredUsername = `${rndstr('A-Z', 4)}${rndstr('a-z', 4)}`;
		const actorId = `${host}/users/${preferredUsername.toLowerCase()}`;

		const name = rndstr('0-9a-z', 129);

		const actor = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: actorId,
			type: 'Person',
			preferredUsername,
			name,
			inbox: `${actorId}/inbox`,
			outbox: `${actorId}/outbox`,
		};

		test('Actor', async () => {
			resolver._register(actor.id, actor);

			const user = await actorService.createPerson(actor.id, resolver);

			assert.deepStrictEqual(user.name, actor.name.substr(0, 128));
		});
	});
});
