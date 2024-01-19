import { MouseEvent, useContext, useEffect, useState } from "react"

import {
	Avatar,
	Style,
	UserName,
	Text,
	MessageContent,
	MaskedMessage
} from "./style"

import ContextualMenuContext from "../../../../../contexts/ContextualMenuContext"
import CardContext from "../../../../../contexts/CardContext"
import DisplayContext from "../../../../../contexts/DisplayContext"
import InteractionContext from "../../../../../contexts/InteractionContext"

import { getContextualMenuHeight } from "../../../../../utils/functions"

import { User } from "../../../../../utils/types"
import { contextualMenuStatus } from "../../../../../utils/status"

type PropsContactText = {
	sender: User,
	content: string
}

function ContactText({ sender, content }: PropsContactText) {

	const { displayContextualMenu, setContextualMenuPosition } = useContext(ContextualMenuContext)!
	const { displayCard, setCardPosition } = useContext(CardContext)!
	const { setZCardIndex, zMaxIndex, GameWrapperRef } = useContext(DisplayContext)!
	const { userTarget, setUserTarget, userAuthenticate, channelTarget } = useContext(InteractionContext)!

	function showCard(event: MouseEvent<HTMLDivElement>) {

		const gameWrapperContainer = GameWrapperRef.current

		if (gameWrapperContainer) {
			setUserTarget(sender)

			const heightCard = 371 // height de la carte
			const { height: GameWrapperHeight, width: GameWrapperWidth } = gameWrapperContainer.getBoundingClientRect() // dimensions de la fenetre de jeu
			const horizontalBorder = window.innerHeight - GameWrapperHeight // height des bordures horizontales autour du jeu
			const verticalBorder = window.innerWidth - GameWrapperWidth // height des bordures verticales autour du jeu
			const heightNavBar = 53 // height de la barre de navigation (logo, info, profil)

			const resultX = window.innerWidth - event.clientX - verticalBorder / 2 // resultat horizontal par defaut (taille de la fenetre - position du clic - bordure de droite)
			const resultY = event.clientY - heightCard - horizontalBorder / 2 - heightNavBar // resultat vertical par defaut (position du clic - height de la carte - bordure du haut - navbar)

			setCardPosition({ right: resultX, top: resultY })
			setZCardIndex(zMaxIndex + 1)
			displayCard(true)
		}
	}

	async function showContextualMenu(event: MouseEvent<HTMLDivElement>) {

		const gameWrapperContainer = GameWrapperRef.current

		if (gameWrapperContainer && channelTarget) {

			setUserTarget(sender)

			const heightContextualMenu = await getContextualMenuHeight(contextualMenuStatus.CHAT, sender, userAuthenticate, channelTarget) // height du menu contextuel du chat
			const { height: GameWrapperHeight } = gameWrapperContainer.getBoundingClientRect() // height de la fenetre de jeu
			const horizontalBorder = window.innerHeight - GameWrapperHeight // height des bordures horizontales autour du jeu
			const maxBottom = window.innerHeight - horizontalBorder - heightContextualMenu // valeur max avant que le menu ne depasse par le bas

			const resultX = window.innerWidth - event.clientX // resultat horizontal par defaut (position du clic)
			let resultY = event.clientY // resultat vertical par defaut (position du clic)

			if (event.clientY - horizontalBorder / 2 > maxBottom) // verifie si le menu depasse sur l'axe vertical
				resultY -= event.clientY - horizontalBorder / 2 - maxBottom // ajuste le resultat vertical

			setContextualMenuPosition({ right: resultX, top: resultY })
			displayContextualMenu({ display: true, type: contextualMenuStatus.CHAT })
		}
	}

	const [showMessage, setShowMessage] = useState(true)
	const senderIsBlocked = userAuthenticate.blockedUsers.includes(sender)

	function handleClickEvent() {
		if (senderIsBlocked)
			setShowMessage(!showMessage)
	}

	useEffect(() => {
		setShowMessage(!senderIsBlocked)
	}, [senderIsBlocked])

	return (
		<Style $masked={senderIsBlocked}>
			{
				showMessage ?
				<>
					<Avatar
						src={sender.avatar}
						onClick={showCard}
						onAuxClick={showContextualMenu} />
					<MessageContent
						onClick={handleClickEvent}>
						<UserName>
							{sender.username}
						</UserName>
						<Text $masked={senderIsBlocked}>
							{content}
						</Text>
					</MessageContent>
				</>
				:
				<MaskedMessage onClick={handleClickEvent}>
					Masked message
				</MaskedMessage>
			}
		</Style>
	)
}

export default ContactText