import express from "express";
import { ObjectId } from "mongodb";
import events from "../database/events";
import groups from "../database/groups";
import invites from "../database/invites";
import users from "../database/user";

const api = express.Router();

api.use((req, res, next) => {
    if (!req.user) return res.redirect("/");

    return next();
});

api.get("/events/delete/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const event = await events.findOne({
        _id: id,
    });

    if (!event) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: event.group,
    });

    if (!group) {
        await event.delete();
        return res.redirect("/groups");
    }

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect(`/groups/${group._id}`);

    await event.delete();

    await groups.findOneAndUpdate(
        { _id: event.group },
        {
            $pull: {
                events: event._id,
            },
        }
    );

    return res.redirect(`/groups/${group._id}/events`);
});

api.post("/events/:id/update", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect("/groups");

    const { name, description, timeRange, dateRange } = req.body;

    await events.findOneAndUpdate(
        {
            name: name.trim(),
            group: group._id,
        },
        {
            name: name.trim(),
            description: description.trim(),
            group: group._id,
            minDuration: timeRange[0] ? toMinutes(timeRange[0]) : null,
            maxDuration: timeRange[1] ? toMinutes(timeRange[1]) : null,
            minDate: dateRange[0],
            maxDate: dateRange[1],
        }
    );

    return res.redirect(`/groups/${group._id}/events`);
});

api.post("/events/:id/create", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect("/groups");

    const { name, description, timeRange, dateRange } = req.body;

    if (
        await events.findOne({
            name: name.trim(),
            group: group._id,
        })
    )
        return res.redirect(`/groups/${group._id}/events`);

    const event = await events.create({
        name: name.trim(),
        description: description.trim(),
        group: group._id,
        minDuration: timeRange[0] ? toMinutes(timeRange[0]) : null,
        maxDuration: timeRange[1] ? toMinutes(timeRange[1]) : null,
        minDate: dateRange[0],
        maxDate: dateRange[1],
    });

    group.events.push(event._id);

    await group.save();

    return res.redirect(`/groups/${group._id}/events`);
});

api.get("/demote/:id/:email", async (req, res) => {
    const { id, email } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (!req.user.groups.includes(id)) return res.redirect("/groups");

    if (
        !(await users.findOne({
            email,
        }))
    )
        return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner === email) return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (!group.managers.includes(email)) return res.redirect(`/groups/${id}`);

    group.managers = group.managers.filter((e: any) => e !== email);
    await group.save();

    //@ts-ignore
    return res.redirect(`/groups/${id}`);
});

api.get("/promote/:id/:email", async (req, res) => {
    const { id, email } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (!req.user.groups.includes(id)) return res.redirect("/groups");

    if (
        !(await users.findOne({
            email,
        }))
    )
        return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner === email) return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.managers.includes(email)) return res.redirect(`/groups/${id}`);

    group.managers.push(email);
    await group.save();

    //@ts-ignore
    return res.redirect(`/groups/${id}`);
});

api.get("/remove/:id/:email", async (req, res) => {
    const { id, email } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (!req.user.groups.includes(id)) return res.redirect("/groups");

    if (
        !(await users.findOne({
            email,
        }))
    )
        return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner === email) return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.owner !== req.user.email && !group.managers.includes(req.user.email))
        return res.redirect(`/groups/${id}`);

    //@ts-ignore
    if (group.managers.includes(email) && group.managers.includes(req.user.email))
        return res.redirect(`/groups/${id}`);

    await users.findOneAndUpdate(
        {
            email,
        },
        {
            $pull: {
                groups: group._id,
            },
        }
    );

    //@ts-ignore
    return res.redirect(`/groups/${id}`);
});

api.get("/decline/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const invite = await invites.findOne({
        _id: id,
    });

    //@ts-ignore
    if (!invite || invite.email !== req.user.email) return res.redirect("/invites");

    invite.delete();

    return res.redirect("/invites");
});

api.get("/delete/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (group.owner !== req.user.email) return res.redirect(`/groups/${id}`);

    await Promise.all(
        (await users.find())
            .filter((user: any) => user.groups.includes(group._id))
            .map((member: any) =>
                users.findOneAndUpdate(
                    {
                        //@ts-ignore
                        email: member.email,
                    },
                    {
                        $pull: {
                            groups: group._id,
                        },
                    }
                )
            )
    );

    await group.delete();

    return res.redirect("/groups");
});

api.get("/leave/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.redirect("/groups");

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (group.owner === req.user.email) return res.redirect(`/groups/${id}`);

    await users.findOneAndUpdate(
        {
            //@ts-ignore
            email: req.user.email,
        },
        {
            $pull: {
                groups: group._id,
            },
        }
    );

    return res.redirect("/groups");
});

api.post("/invite/:id", async (req, res) => {
    const { id } = req.params;

    const group = await groups.findOne({
        _id: id,
    });

    if (!group) return res.redirect("/groups");

    //@ts-ignore
    if (group.owner !== req.user.email && !group.managers.includes(req.user.email))
        return res.redirect(`/groups/${id}`);

    const emails: string[] = req.body.email.split(/\s+/g);

    await Promise.all(
        emails.map(async (email) => {
            if (
                !(await users.findOne({
                    email,
                }))
            )
                return;

            //@ts-ignore
            if (email === req.user.email) return;

            return invites.create({
                group: group._id,
                email,
                //@ts-ignore
                inviter: req.user.email,
            });
        })
    );

    return res.redirect(`/groups/${id}`);
});

api.post("/create", async (req, res) => {
    const { name, description, website, icon, email } = req.body;

    const group = await groups.create({
        name,
        description,
        website,
        icon: icon || "/images/group.png",
        owner: email,
    });

    await users.findOneAndUpdate(
        {
            email: email,
        },
        {
            $push: {
                groups: group._id,
            },
        }
    );

    res.redirect(`/groups/${group._id}`);
});

const toMinutes = (timeStr: string) =>
    timeStr
        .split(":")
        .reduce((acc, cur, i) => (i === 0 ? acc + parseInt(cur) * 60 : acc + parseInt(cur)), 0);

export default api;
