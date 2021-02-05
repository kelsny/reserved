import express from "express";
import groups from "../database/groups";
import invites from "../database/invites";
import users from "../database/user";

const api = express.Router();

api.use((req, res, next) => {
    if (!req.user) return res.redirect("/");

    return next();
});

api.get("/demote/:id/:email", async (req, res) => {
    const { id, email } = req.params;

    const group = await groups.findById(id);

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

    const group = await groups.findById(id);

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

    const group = await groups.findById(id);

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

    const invite = await invites.findById(id);

    if (invite) invite.delete();

    return res.redirect("/invites");
});

api.get("/delete/:id", async (req, res) => {
    const { id } = req.params;

    const group = await groups.findById(id);

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

    const group = await groups.findById(id);

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

    const group = await groups.findById(id);

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

export default api;
