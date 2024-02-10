import {
	Dispatch,
	SetStateAction
} from "react"

import {
	findUserInChannel,
	removeUserInChannel,
	setUserToAdministrator,
	setUserToBanned,
	setUserToMember,
	setUserToOwner,
	updateUserDatasInChannel,
	updateUserStatusInChannel,
	userIsFriend,
	userIsInChannel
} from "../../utils/functions"

import {
	ChannelType,
	challengeStatus,
	channelRole,
	messageType,
	userStatus
} from "../../utils/status"

import {
	Channel,
	ChannelData,
	MessageInvitation,
	MessageText,
	User,
	UserAuthenticate
} from "../../utils/types"

// Fonctions appellées uniquement lors d'emits de socekts. Ces fonctions servent à mettre à jour des données en temps réel chez l'ensemble des utilisateurs 

type PropsPostText = {
	channelId: number,
	userId: number,
	textDatas: any

	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

export function postText(props: PropsPostText) {
	
	if (props.channelTarget?.id === props.channelId)
	{
		const userSend = findUserInChannel(props.channelTarget, props.userId)
		if (!userSend)
			throw new Error

		const messageContent: MessageText = {
			id: props.textDatas.id,
			sender: userSend,
			type: messageType.TEXT,
			content: props.textDatas.content
		}
		
		props.setChannelTarget((prevState: Channel | undefined) => {
		if (prevState)
		{
			return {
				...prevState,
				messages: [
					...prevState.messages,
					messageContent
				]
			}
		}
		else
			return (undefined)
		})
	}
}

type PropsPostInvitation = {
	channelId: number,
	userAuthId: number,
	userTargetId: number,
	invitationDatas: any

	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

export function postInvitation(props: PropsPostInvitation) {
	
	if (props.channelTarget?.id === props.channelId)
	{
		const userSend = findUserInChannel(props.channelTarget, props.userAuthId)
		if (!userSend)
			throw new Error

		const userTarget = findUserInChannel(props.channelTarget, props.userTargetId)
		if (!userTarget)
			throw new Error

		const messageContent: MessageInvitation = {
			id: props.invitationDatas.id,
			sender: userSend,
			type: messageType.INVITATION,
			target: userTarget,
			status: challengeStatus.PENDING
		}
		
		props.setChannelTarget((prevState: Channel | undefined) => {
		if (prevState)
		{
			return {
				...prevState,
				messages: [
					...prevState.messages,
					messageContent
				]
			}
		}
		else
			return (undefined)
		})
	}
}

type PropsRefreshJoinChannel = {
	channelId: number,
	userId: number,
	channelDatas: ChannelData,
	newMember: User,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>

}

export async function refreshJoinChannel(props: PropsRefreshJoinChannel) {

	// Valide si le user auth est invité dans le channel
	if (props.userId === props.userAuthenticate.id)
	{
		props.setUserAuthenticate((prevState: UserAuthenticate) => ({
			...prevState,
			channels: [ ...prevState.channels, props.channelDatas ]
		}))
	}

	// Valide si le user auth déjà présent dans le channel a la fenêtre de chat ouverte
	else if (props.channelTarget?.id === props.channelId)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
			{
				return {
					...prevState,
					members: [
						...prevState.members,
						props.newMember
					]
				}
			}
			else
				return (undefined)
		})
	}
}


type PropsRefreshLeaveChannel = {
	channelId: number,
	userId: number,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}


export async function refreshLeaveChannel(props: PropsRefreshLeaveChannel) {

	if (props.userId === props.userAuthenticate.id)
	{
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				channels: prevState.channels.filter((channel) => channel.id !== props.channelId)
			}
		})
		if (props.channelTarget?.id === props.channelId)
			props.setChannelTarget(undefined)
	}
	else if (props.channelTarget?.id === props.channelId)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
			{
				return {
					...prevState,
					members: prevState.members.filter((member) => member.id !== props.userId),
					administrators: prevState.administrators.filter((administrator) => administrator.id !== props.userId),
					owner: prevState.owner?.id === props.userId ? undefined : prevState.owner
				}
			}
			else
				return (undefined)
		})	
	}
}

type PropsRefreshUserRole = {
	channelId: number,
	userId: number,
	newRole: any,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

export async function refreshUserRole(props : PropsRefreshUserRole) {
	try {
		if (props.newRole === channelRole.BANNED && props.userAuthenticate.id === props.userId)
		{
			await refreshLeaveChannel({
				channelId: props.channelId,
				userId: props.userId,
				userAuthenticate: props.userAuthenticate,
				setUserAuthenticate: props.setUserAuthenticate,
				channelTarget: props.channelTarget,
				setChannelTarget: props.setChannelTarget
			})
		}
		else if (props.channelTarget?.id === props.channelId)
		{
			const setChannel = props.setChannelTarget as Dispatch<SetStateAction<Channel>> 

			if (props.newRole === channelRole.UNBANNED) {
				setChannel((prevState: Channel) => {
					return (removeUserInChannel(prevState, props.userId))
				})
			}
			else
			{
				const userTarget = findUserInChannel(props.channelTarget, props.userId)
				if (!userTarget)
					throw new Error

				if (props.newRole === channelRole.MEMBER) {
					setChannel((prevState: Channel) => {
						return (setUserToMember(prevState, userTarget))
					})
				}
				else if (props.newRole === channelRole.ADMIN) {	
					setChannel((prevState: Channel) => {
						return (setUserToAdministrator(prevState, userTarget))
					})
				}
				else if (props.newRole === channelRole.BANNED) {	
					setChannel((prevState: Channel) => {
						return (setUserToBanned(prevState, userTarget))
					})
				}
			}
		}
	}
	catch (error) {
		console.log(error)
	}

}

type PropsRefreshNewOwner = {
	channelId: number,
	userId: number,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

export async function refreshNewOwner(props: PropsRefreshNewOwner) {
	if (props.userId === props.userAuthenticate.id)
	{
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				channels: prevState.channels.map((channel: Channel | ChannelData) => {
					if (channel.id === props.channelId)
						return (setUserToOwner(channel as Channel, prevState))
					else
						return (channel)
				})
			}
		})
	}
	if (props.channelTarget?.id === props.channelId)
	{
		const userTarget = findUserInChannel(props.channelTarget, props.userId)
		if (!userTarget)
			throw new Error
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
				return (setUserToOwner(prevState, userTarget))
			else
				return (undefined)
		})	
	}
}

type PropsRefreshUserDatas = {
	userId: number,
	newDatas: any,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

// Met à jour les datas d'un user
export function refreshUserDatas(props: PropsRefreshUserDatas) {

	if (props.userId === props.userAuthenticate.id) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				username: props.newDatas.username,
				avatar: props.newDatas.avatar
			}
		})
	}
	else if (userIsFriend(props.userAuthenticate, props.userId)) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				friends: prevState.friends.map((friend) => {
					if (friend.id === props.userId) {
						return {
							...friend,
							username: props.newDatas.username,
							avatar: props.newDatas.avatar
						}
					}
					else
						return (friend)
				})
			}
		})

	}
}

type PropsRefreshUserStatus = {
	userId: number,
	newStatus: userStatus,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

// Met à jour le statut d'un user
export function refreshUserStatus(props: PropsRefreshUserStatus) {

	if (props.userId === props.userAuthenticate.id) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				status: props.newStatus
			}
		})
	}
	else if (userIsFriend(props.userAuthenticate, props.userId)) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				friends: prevState.friends.map((friend) => {
					if (friend.id === props.userId) {
						return {
							...friend,
							status: props.newStatus
						}
					}
					else
						return (friend)
				})
			}
		})
	}
}

type PropsRefreshUpdateChannel = {
	channelId: number,
	newDatas: any,

	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

// Met à jour les données d'un channel
export function refreshUpdateChannel(props: PropsRefreshUpdateChannel) {
	if (props.channelTarget?.id === props.channelId)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState) {
				return {
					...prevState,
					...props.newDatas
				}
			}
			else
				return (undefined)

		});
	}

	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: prevState.channels.map((channel) => {
			if (channel.id === props.channelId) {
				return {
					...channel,
					...props.newDatas
				}
			}
			else
				return channel
		})
	}))
}

type PropsRefreshDeleteChannel = {
	channelId: number,

	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

// Supprime un channel
export function refreshDeleteChannel(props: PropsRefreshDeleteChannel) {
	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: prevState.channels.filter((channel) => channel.id !== props.channelId)
	}))

	if (props.channelTarget && props.channelTarget.id === props.channelId)
		props.setChannelTarget(undefined)
}


type RefreshUserMuteProps = {
	idChan: number,
	time: string,

	userAuthenticate: UserAuthenticate,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}


export async function refreshUserMute(props : RefreshUserMuteProps) {
	if (props.idChan === props.channelTarget?.id)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
		if (prevState) {
			const updatedMuteInfo = {
				...prevState.muteInfo,
				[props.userAuthenticate.id]: props.time,
				};
			return {
			...prevState,
			muteInfo: updatedMuteInfo,
			};
		} else {
			return undefined;
		}
		});
	}
}

type RefreshStatusChallengeProps = {
	channelId: number,
	messageId: number,
	newStatus: challengeStatus,

	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

// Met a jour le statut d'une invitation
	export async function refreshStatusChallenge(props : RefreshStatusChallengeProps) {
		if (props.channelId === props.channelTarget?.id)
		{
						props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState) {
				const updatedMessages = prevState.messages.map((message) =>
				message.id === props.messageId ? { ...message, status: props.newStatus } : message
				);
				return {
				...prevState,
				messages:updatedMessages,
				};
			} else {
				return undefined;
			}
			});
		}
	}  

type PropsRecieveChannelMP = {
	channelId: number,
	authorDatas: any,

	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
}
	
// Crée un channel MP chez le destinataire
export async function recieveChannelMP(props: PropsRecieveChannelMP) {
	const newChannelMP: ChannelData = {
		id: props.channelId,
		name: props.authorDatas.username,
		avatar: props.authorDatas.avatar,
		type: ChannelType.MP
	}

	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: [
			...prevState.channels,
			newChannelMP
		]
	}))
}