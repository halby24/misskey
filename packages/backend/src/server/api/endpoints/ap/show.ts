import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UsersRepository, NotesRepository } from '@/models/index.js';
import type { Note } from '@/models/entities/Note.js';
import type { LocalUser, User } from '@/models/entities/User.js';
import type { Channel } from '@/models/entities/Channel.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { isPersonOrService, isGroup, isPost, getApId, IObject } from '@/core/activitypub/type.js';
import type { SchemaType } from '@/misc/schema.js';
import { ApResolverService } from '@/core/activitypub/ApResolverService.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import { MetaService } from '@/core/MetaService.js';
import { ApActorService } from '@/core/activitypub/models/ApActorService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['federation'],

	requireCredential: true,

	limit: {
		duration: ms('1hour'),
		max: 30,
	},

	errors: {
		noSuchObject: {
			message: 'No such object.',
			code: 'NO_SUCH_OBJECT',
			id: 'dc94d745-1262-4e63-a17d-fecaa57efc82',
		},
	},

	res: {
		optional: false, nullable: false,
		oneOf: [
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						optional: false, nullable: false,
						enum: ['User'],
					},
					object: {
						type: 'object',
						optional: false, nullable: false,
						ref: 'UserDetailedNotMe',
					},
				},
			},
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						optional: false, nullable: false,
						enum: ['Channel'],
					},
					object: {
						type: 'object',
						optional: false, nullable: false,
						ref: 'Channel',
					},
				},
			},
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						optional: false, nullable: false,
						enum: ['Note'],
					},
					object: {
						type: 'object',
						optional: false, nullable: false,
						ref: 'Note',
					},
				},
			},
		],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		uri: { type: 'string' },
	},
	required: ['uri'],
} as const;

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private utilityService: UtilityService,
		private userEntityService: UserEntityService,
		private channelEntityService: ChannelEntityService,
		private noteEntityService: NoteEntityService,
		private metaService: MetaService,
		private apResolverService: ApResolverService,
		private apDbResolverService: ApDbResolverService,
		private apActorService: ApActorService,
		private apNoteService: ApNoteService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const object = await this.fetchAny(ps.uri, me);
			if (object) {
				return object;
			} else {
				throw new ApiError(meta.errors.noSuchObject);
			}
		});
	}

	/***
	 * URIからUserかNoteを解決する
	 */
	@bindThis
	private async fetchAny(uri: string, me: LocalUser | null | undefined): Promise<SchemaType<typeof meta.res> | null> {
		// ブロックしてたら中断
		const fetchedMeta = await this.metaService.fetch();
		if (this.utilityService.isBlockedHost(fetchedMeta.blockedHosts, this.utilityService.extractDbHost(uri))) return null;

		let local = await this.mergePack(me, ...await Promise.all([
			this.apDbResolverService.getUserFromApId(uri),
			this.apDbResolverService.getNoteFromApId(uri),
		]));
		if (local != null) return local;

		// リモートから一旦オブジェクトフェッチ
		const resolver = this.apResolverService.createResolver();
		const object = await resolver.resolve(uri);

		// /@user のような正規id以外で取得できるURIが指定されていた場合、ここで初めて正規URIが確定する
		// これはDBに存在する可能性があるため再度DB検索
		if (uri !== object.id) {
			local = await this.mergePack(me, ...await Promise.all([
				this.apDbResolverService.getUserFromApId(object.id!),
				this.apDbResolverService.getNoteFromApId(object.id!),
			]));
			if (local != null) return local;
		}

		const createUserOrChannel = async (o: IObject): Promise<User | Channel | null> => {
			if (isPersonOrService(o)) {
				return await this.apActorService.createUser(getApId(object));
			} else if (isGroup(o)) {
				return await this.apActorService.createChannel(getApId(object));
			} else {
				return null;
			}
		};

		return await this.mergePack(
			me,
			await createUserOrChannel(object),
			isPost(object) ? await this.apNoteService.createNote(getApId(object), undefined, true) : null,
		);
	}

	@bindThis
	private async mergePack(me: LocalUser | null | undefined, user: User | Channel | null | undefined, note: Note | null | undefined): Promise<SchemaType<typeof meta.res> | null> {
		if (user != null) {
			if ('username' in user) { // ちょっと判定ガバい
				return {
					type: 'User',
					object: await this.userEntityService.pack(user as User, me, { detail: true }),
				};
			} else {
				return {
					type: 'Channel',
					object: await this.channelEntityService.pack(user as Channel, me),
				};
			}
		} else if (note != null) {
			try {
				const object = await this.noteEntityService.pack(note, me, { detail: true });

				return {
					type: 'Note',
					object,
				};
			} catch (e) {
				return null;
			}
		}

		return null;
	}
}
