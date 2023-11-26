import {
	createContext,
	Dispatch,
	SetStateAction
} from 'react'

const CardContext = createContext<{
	card: boolean,
	displayCard: Dispatch<SetStateAction<boolean>>,
	cardPosition: { top: string; left: string },
	setCardPosition: Dispatch<SetStateAction<{ top: string, left: string }>>,
	cardUsername: string,
	setCardUserName: Dispatch<SetStateAction<string>>
} | undefined>(undefined)

export default CardContext