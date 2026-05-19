import { Component, input } from '@angular/core';

@Component({
  selector: 'app-paywall',
  imports: [],
  templateUrl: './paywall.html',
  styleUrl: './paywall.scss',
})
export class Paywall {

  title = input('titre');

  subtitle = input(
    'sous titre'
  );

}