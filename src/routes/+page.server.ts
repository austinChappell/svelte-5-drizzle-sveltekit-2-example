import { and, asc, between, count, eq } from 'drizzle-orm';
import { db } from '../hooks.server';
import { checks, habits } from '../schema';
import { transform_habits, update_habits_order } from '../server/data_utils';
import { fail } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	// let date_tree =
	// TODO function that builds date
	// Building blocks for how I want to query moving forward

	//  Add check for proper month between. rn will always return January
	// TODO fix before Feb
	const habits_data = await db.query.habits.findMany({
		where: eq(habits.user_id, locals?.user?.id),
		orderBy: [asc(habits.order)],
		with: {
			checks: {
				where: between(checks.checked_at, '2024-01-01', '2024-01-31'),
			},
		},
	});

	return {
		habits: transform_habits(habits_data),
	};
};

export const actions = {
	async new_habit({ locals }) {
		const { name, days_per_month } = locals.form_data as {
			name: string;
			days_per_month: string;
		};

		if (locals?.user?.id) {
			const trimmed_name = name.trim();
			const days_per_month_int = parseInt(days_per_month);

			if (trimmed_name.length < 1) {
				return fail(422, { message: 'Name must be at least 1 character' });
			}

			if (trimmed_name.length > 255) {
				return fail(422, { message: 'Name must be less than 255 characters' });
			}

			if (!days_per_month_int || Number.isNaN(days_per_month_int)) {
				return fail(422, { message: 'Days per month must be a number' });
			}

			if (days_per_month_int < 1 || days_per_month_int > 31) {
				return fail(422, { message: 'Days per month must be between 1 and 31' });
			}

			const result = await db
				.select({ count: count() })
				.from(habits)
				.where(eq(habits.user_id, locals.user.id));
			const totalCount = result[0].count;

			await db.insert(habits).values({
				user_id: locals.user.id,
				name: trimmed_name,
				days_per_month: days_per_month_int,
				updated_at: new Date(),
				created_at: new Date(),
				order: totalCount * 10,
			});
		}
	},

	async update_habit({ locals }) {
		const { habit_id, name, days_per_month } = locals.form_data as {
			name: string;
			days_per_month: string;
			habit_id: number;
		};

		if (locals?.user?.id) {
			await db
				.update(habits)
				.set({ name, days_per_month: parseInt(days_per_month), updated_at: new Date() })
				.where(eq(habits.id, habit_id));
		}
	},

	async add_check({ locals }) {
		const { habit_id, checked_at } = locals.form_data as {
			habit_id: string;
			checked_at: string;
		};
		if (locals?.user?.id) {
			await db.insert(checks).values({
				user_id: locals.user.id,
				habit_id: parseInt(habit_id),
				checked_at,
			});
		}
	},

	async remove_check({ locals }) {
		const { checked_at, habit_id } = locals.form_data as { checked_at: string; habit_id: number };

		if (locals?.user?.id) {
			await db
				.delete(checks)
				.where(
					and(
						eq(checks.habit_id, habit_id),
						eq(checks.user_id, locals?.user?.id),
						eq(checks.checked_at, checked_at),
					),
				);
		}
	},

	async hide_habit({ locals }) {
		const { habit_id } = locals.form_data as { habit_id: number };
		if (locals?.user?.id)
			await db
				.update(habits)
				.set({ status: 'HIDDEN', updated_at: new Date() })
				.where(and(eq(habits.id, habit_id), eq(habits.user_id, locals?.user?.id)));
	},

	async archive_habit({ locals }) {
		const { habit_id } = locals.form_data as { habit_id: number };

		if (locals?.user?.id)
			await db
				.update(habits)
				.set({ status: 'ARCHIVED', updated_at: new Date() })
				.where(and(eq(habits.id, habit_id), eq(habits.user_id, locals?.user?.id)));
	},

	async show_habit({ locals }) {
		const { habit_id } = locals.form_data as { habit_id: number };

		if (locals?.user?.id) {
			await db
				.update(habits)
				.set({ status: 'VISIBLE', updated_at: new Date() })
				.where(and(eq(habits.id, habit_id), eq(habits.user_id, locals?.user?.id)));
		}
	},

	async delete_habit({ locals }) {
		const { habit_id } = locals.form_data as { habit_id: number };

		if (locals?.user?.id) {
			await db
				.delete(habits)
				.where(and(eq(habits.id, habit_id), eq(habits.user_id, locals?.user?.id)));
		}
	},
	async reorder({ locals }) {
		const { new_ids } = locals.form_data as { new_ids: string };
		const new_id_array = JSON.parse(new_ids);

		if (locals?.user?.id) {
			await update_habits_order(new_id_array, locals.user.id);
			return {
				message: 'Habits reordered successfully',
			};
		}
	},
};
