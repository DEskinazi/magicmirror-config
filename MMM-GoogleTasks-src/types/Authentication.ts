export interface AccountToken {
  account: string;
  token: Token;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}
