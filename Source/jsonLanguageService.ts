/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentLink } from "vscode-languageserver-types";

import {
	ASTNode,
	Color,
	ColorInformation,
	ColorPresentation,
	CompletionItem,
	CompletionList,
	DefinitionLink,
	Diagnostic,
	ColorInformationContext as DocumentColorsContext,
	DocumentLanguageSettings,
	DocumentSymbol,
	DocumentSymbolsContext,
	FoldingRange,
	FoldingRangesContext,
	FormattingOptions,
	Hover,
	JSONLanguageStatus,
	JSONSchema,
	LanguageServiceParams,
	LanguageSettings,
	MatchingSchema,
	Position,
	Range,
	SelectionRange,
	SortOptions,
	SymbolInformation,
	TextDocument,
	TextEdit,
} from "./jsonLanguageTypes";
import { newJSONDocument, parse as parseJSON } from "./parser/jsonParser";
import { schemaContributions } from "./services/configuration";
import { JSONCompletion } from "./services/jsonCompletion";
import { JSONDocumentSymbols } from "./services/jsonDocumentSymbols";
import { getFoldingRanges } from "./services/jsonFolding";
import { JSONHover } from "./services/jsonHover";
import { findLinks } from "./services/jsonLinks";
import { JSONSchemaService } from "./services/jsonSchemaService";
import { getSelectionRanges } from "./services/jsonSelectionRanges";
import { JSONValidation } from "./services/jsonValidation";
import { format } from "./utils/format";
import { sort } from "./utils/sort";

export type JSONDocument = {
	root: ASTNode | undefined;

	getNodeFromOffset(
		offset: number,
		includeRightBound?: boolean,
	): ASTNode | undefined;
};

export * from "./jsonLanguageTypes";

export interface LanguageService {
	configure(settings: LanguageSettings): void;

	doValidation(
		document: TextDocument,
		jsonDocument: JSONDocument,
		documentSettings?: DocumentLanguageSettings,
		schema?: JSONSchema,
	): PromiseLike<Diagnostic[]>;
	parseJSONDocument(document: TextDocument): JSONDocument;
	newJSONDocument(
		rootNode: ASTNode,
		syntaxDiagnostics?: Diagnostic[],
	): JSONDocument;
	resetSchema(uri: string): boolean;

	getMatchingSchemas(
		document: TextDocument,
		jsonDocument: JSONDocument,
		schema?: JSONSchema,
	): PromiseLike<MatchingSchema[]>;

	getLanguageStatus(
		document: TextDocument,
		jsonDocument: JSONDocument,
	): JSONLanguageStatus;

	doResolve(item: CompletionItem): PromiseLike<CompletionItem>;

	doComplete(
		document: TextDocument,
		position: Position,
		doc: JSONDocument,
	): PromiseLike<CompletionList | null>;
	findDocumentSymbols(
		document: TextDocument,
		doc: JSONDocument,
		context?: DocumentSymbolsContext,
	): SymbolInformation[];
	findDocumentSymbols2(
		document: TextDocument,
		doc: JSONDocument,
		context?: DocumentSymbolsContext,
	): DocumentSymbol[];
	findDocumentColors(
		document: TextDocument,
		doc: JSONDocument,
		context?: DocumentColorsContext,
	): PromiseLike<ColorInformation[]>;

	getColorPresentations(
		document: TextDocument,
		doc: JSONDocument,
		color: Color,
		range: Range,
	): ColorPresentation[];

	doHover(
		document: TextDocument,
		position: Position,
		doc: JSONDocument,
	): PromiseLike<Hover | null>;

	getFoldingRanges(
		document: TextDocument,
		context?: FoldingRangesContext,
	): FoldingRange[];

	getSelectionRanges(
		document: TextDocument,
		positions: Position[],
		doc: JSONDocument,
	): SelectionRange[];
	findDefinition(
		document: TextDocument,
		position: Position,
		doc: JSONDocument,
	): PromiseLike<DefinitionLink[]>;
	findLinks(
		document: TextDocument,
		doc: JSONDocument,
	): PromiseLike<DocumentLink[]>;

	format(
		document: TextDocument,
		range: Range,
		options: FormattingOptions,
	): TextEdit[];
	sort(document: TextDocument, options: SortOptions): TextEdit[];
}

export function getLanguageService(
	params: LanguageServiceParams,
): LanguageService {
	const promise = params.promiseConstructor || Promise;

	const jsonSchemaService = new JSONSchemaService(
		params.schemaRequestService,
		params.workspaceContext,
		promise,
	);
	jsonSchemaService.setSchemaContributions(schemaContributions);

	const jsonCompletion = new JSONCompletion(
		jsonSchemaService,
		params.contributions,
		promise,
		params.clientCapabilities,
	);

	const jsonHover = new JSONHover(
		jsonSchemaService,
		params.contributions,
		promise,
	);

	const jsonDocumentSymbols = new JSONDocumentSymbols(jsonSchemaService);

	const jsonValidation = new JSONValidation(jsonSchemaService, promise);

	return {
		configure: (settings: LanguageSettings) => {
			jsonSchemaService.clearExternalSchemas();

			settings.schemas?.forEach(
				jsonSchemaService.registerExternalSchema.bind(
					jsonSchemaService,
				),
			);
			jsonValidation.configure(settings);
		},
		resetSchema: (uri: string) => jsonSchemaService.onResourceChange(uri),
		doValidation: jsonValidation.doValidation.bind(jsonValidation),
		getLanguageStatus:
			jsonValidation.getLanguageStatus.bind(jsonValidation),
		parseJSONDocument: (document: TextDocument) =>
			parseJSON(document, { collectComments: true }),
		newJSONDocument: (root: ASTNode, diagnostics: Diagnostic[]) =>
			newJSONDocument(root, diagnostics),
		getMatchingSchemas:
			jsonSchemaService.getMatchingSchemas.bind(jsonSchemaService),
		doResolve: jsonCompletion.doResolve.bind(jsonCompletion),
		doComplete: jsonCompletion.doComplete.bind(jsonCompletion),
		findDocumentSymbols:
			jsonDocumentSymbols.findDocumentSymbols.bind(jsonDocumentSymbols),
		findDocumentSymbols2:
			jsonDocumentSymbols.findDocumentSymbols2.bind(jsonDocumentSymbols),
		findDocumentColors:
			jsonDocumentSymbols.findDocumentColors.bind(jsonDocumentSymbols),
		getColorPresentations:
			jsonDocumentSymbols.getColorPresentations.bind(jsonDocumentSymbols),
		doHover: jsonHover.doHover.bind(jsonHover),
		getFoldingRanges,
		getSelectionRanges,
		findDefinition: () => Promise.resolve([]),
		findLinks,
		format: (
			document: TextDocument,
			range: Range,
			options: FormattingOptions,
		) => format(document, options, range),
		sort: (document: TextDocument, options: FormattingOptions) =>
			sort(document, options),
	};
}
